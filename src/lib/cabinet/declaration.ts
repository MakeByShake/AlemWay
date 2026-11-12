import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { FERIENJOB_FULL_SECTIONS, toGermanDate } from "./fields";
import { DECLARATION_PDF_KEYS, type AiCheck, type DeclarationFields } from "@/lib/ai/declaration";
import { deleteFile, saveFile } from "./storage";
import { patchCabinet, type Cabinet, type StoredFile } from "./server";

// Official BA form «Declaration of Certificate of Enrolment – Vacation Job», AMZ 06/2026 (2 pages), unchanged.
// Only the field values are written, the way the team's fill2.py does it: same Roboto 9 pt font from the form,
// the form keeps its frames, logo, barcodes *S1*/*S2* and stays fillable (nothing is flattened).
const BLANK = path.join(process.cwd(), "src", "assets", "zav-declaration-2026-06.pdf");

/** Today in Kazakhstan, as YYYY-MM-DD. */
export function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

const FONT = "Roboto-Regular";
const SIZE = 9;

/** The form's font is WinAnsi (cp1252): typographic marks → ASCII, Kazakh letters → Latin, the rest dropped. */
function toWinAnsi(s: string) {
  const map: Record<string, string> = { "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "«": '"', "»": '"', "№": "No.", "\u00a0": " ",
    ә: "a", Ә: "A", ғ: "g", Ғ: "G", қ: "k", Қ: "K", ң: "n", Ң: "N", ө: "o", Ө: "O", ұ: "u", Ұ: "U", ү: "u", Ү: "U", һ: "h", Һ: "H", і: "i", І: "I" };
  return [...s.normalize("NFC")]
    .map((c) => map[c] ?? c)
    .join("")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n >= 0x20 && n <= 0xff && !(n >= 0x7f && n <= 0x9f);
    })
    .join("");
}

/** Fills the official form with the AI's data (keys = PDF field names, dates DD.MM.YYYY). */
export async function buildDeclarationPdf(fields: DeclarationFields): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fs.readFile(BLANK));
  const form = doc.getForm();
  const acro = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
  const fontRef = acro.lookup(PDFName.of("DR"), PDFDict).lookup(PDFName.of("Font"), PDFDict).get(PDFName.of(FONT))!;
  const font = doc.context.lookup(fontRef, PDFDict);
  const first = (font.lookup(PDFName.of("FirstChar"), PDFNumber) as PDFNumber).asNumber();
  const widths = font.lookup(PDFName.of("Widths"), PDFArray).asArray().map((w) => (doc.context.lookup(w) as PDFNumber).asNumber());
  const textWidth = (t: string, size = SIZE) => [...t].reduce((sum, c) => sum + (widths[c.charCodeAt(0) - first] ?? 500), 0) * (size / 1000);
  const lit = (t: string) => `(${t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
  const wrap = (t: string, max: number) => {
    const lines: string[] = [];
    let cur = "";
    for (const word of t.split(" ")) {
      const next = `${cur} ${word}`.trim();
      if (cur && textWidth(next) > max) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    return [...lines, cur];
  };

  for (const key of DECLARATION_PDF_KEYS) {
    const raw = (fields[key] ?? "").trim();
    const field = form.getField(key);

    if (key === "rbtnStudiumFortsetzung") {
      // Widget states: /0 = Yes, /1 = No.
      const on = /^(no|nein|нет)$/i.test(raw) ? "1" : "0";
      field.acroField.dict.set(PDFName.of("V"), PDFName.of(on));
      for (const w of field.acroField.getWidgets()) {
        const states = w.dict.lookup(PDFName.of("AP"), PDFDict).lookup(PDFName.of("N"), PDFDict).keys().map((k) => k.decodeText());
        w.dict.set(PDFName.of("AS"), PDFName.of(states.includes(on) ? on : "Off"));
      }
      continue;
    }

    const v = toWinAnsi(raw);
    field.acroField.dict.set(PDFName.of("V"), PDFHexString.fromText(v));
    for (const w of field.acroField.getWidgets()) {
      const { width: W, height: H } = w.getRectangle();
      const ap = w.dict.lookup(PDFName.of("AP"), PDFDict);
      const old = doc.context.lookup(ap.get(PDFName.of("N"))) as PDFRawStream;
      const content = Buffer.from(decodePDFRawStream(old).decode()).toString("latin1");
      let size = SIZE;
      let body: string;
      if (H > 20) {
        // University name: two lines, wrapped by width.
        const lines = wrap(v, W - 4);
        body = `2 ${(H - 11.5).toFixed(1)} Td\n` + lines.map((l) => `${lit(l)} Tj`).join(" 0 -10.5 Td\n");
      } else {
        // A value too long for its box is set a bit smaller instead of being cut off.
        if (textWidth(v) > W - 4) size = Math.max(6, Math.floor(((W - 4) / textWidth(v, 1)) * 10) / 10);
        body = `2 6.2 Td\n${lit(v)} Tj`;
      }
      const text = `/Tx BMC\nq\n1 1 ${(W - 2).toFixed(0)} ${(H - 2).toFixed(0)} re\nW\nn\nBT\n/${FONT} ${size} Tf 0 g\n${body}\nET\nQ\nEMC\n`;
      if (!content.includes("/Tx BMC\nEMC\n")) throw new Error(`Unexpected appearance in field ${key}`);
      const next = content.replace("/Tx BMC\nEMC\n", text);

      const dict = old.dict.clone(doc.context);
      dict.delete(PDFName.of("Filter"));
      dict.delete(PDFName.of("DecodeParms"));
      const res = ((old.dict.lookup(PDFName.of("Resources")) as PDFDict | undefined) ?? doc.context.obj({})).clone(doc.context);
      const fonts = (res.lookup(PDFName.of("Font")) as PDFDict | undefined)?.clone(doc.context) ?? doc.context.obj({});
      fonts.set(PDFName.of(FONT), fontRef);
      res.set(PDFName.of("Font"), fonts);
      dict.set(PDFName.of("Resources"), res);
      const stream = PDFRawStream.of(dict, Buffer.from(next, "latin1"));
      ap.set(PDFName.of("N"), doc.context.register(stream));
    }
  }
  return doc.save();
}

/**
 * The questionnaire gets everything the AI took from the documents (university, address, subject, study dates,
 * name in Latin…), so the team sees a complete client card. Keys come from the form's `pdf` field names.
 */
export function anketaFromDeclaration(fields: Partial<DeclarationFields>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FERIENJOB_FULL_SECTIONS.flatMap((s) => s.fields)) {
    if (!f.pdf) continue;
    const v = (fields[f.pdf as keyof DeclarationFields] ?? "").trim();
    if (!v) continue;
    if (f.kind === "date") {
      const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) out[f.key] = `${m[3]}-${m[2]}-${m[1]}`;
    } else if (f.kind === "yesno") out[f.key] = /^(no|nein|нет)$/i.test(v) ? "no" : "yes";
    else out[f.key] = v;
  }
  return out;
}

/**
 * Questionnaire values the team corrected in the admin, as declaration fields (dates DD.MM.YYYY).
 * They replace what the AI read from the documents: the manager has checked them by hand.
 */
export function teamOverrides(cab: Pick<Cabinet, "data" | "teamEdited">): Partial<DeclarationFields> {
  const edited = new Set(cab.teamEdited ?? []);
  const out: Partial<DeclarationFields> = {};
  for (const f of FERIENJOB_FULL_SECTIONS.flatMap((s) => s.fields)) {
    if (!f.pdf || !edited.has(f.key)) continue;
    const v = (cab.data?.[f.key] ?? "").trim();
    if (!v) continue;
    const key = f.pdf as keyof DeclarationFields;
    if (f.kind === "date") out[key] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? toGermanDate(v) : v;
    else if (f.kind === "yesno") out[key] = v === "no" ? "No" : "Yes";
    else out[key] = v;
  }
  return out;
}

/** Reads the field values of a filled declaration PDF (made by our site or the team's script); empty if it has no form. */
export async function readDeclarationFields(bytes: Uint8Array): Promise<Partial<DeclarationFields>> {
  const out: Partial<DeclarationFields> = {};
  try {
    const form = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getForm();
    for (const key of DECLARATION_PDF_KEYS) {
      const f = form.getFieldMaybe(key);
      if (!f) continue;
      if (key === "rbtnStudiumFortsetzung") {
        const v = String(f.acroField.dict.get(PDFName.of("V")) ?? "");
        if (v) out[key] = /\/(1|no|nein)$/i.test(v) ? "No" : "Yes";
      } else if ("getText" in f) {
        const v = (f as unknown as { getText(): string | undefined }).getText()?.trim();
        if (v) out[key] = v;
      }
    }
  } catch {
    // Scanned or flattened PDF: nothing to read.
  }
  return out;
}

/** Questionnaire fields that are still empty, filled from the declaration's values (never overwrites). */
export function missingAnketaFromDeclaration(cab: Pick<Cabinet, "data">, fields: Partial<DeclarationFields>) {
  return Object.fromEntries(
    Object.entries(anketaFromDeclaration(fields))
      .filter(([k]) => !(cab.data?.[k] ?? "").trim())
      .map(([k, v]) => [`data.${k}`, v])
  );
}

/** Stores the declaration made from the AI check and moves the cabinet to «Декларация готова». */
export async function saveAiDeclaration(cab: Cabinet, ai: AiCheck): Promise<StoredFile> {
  const dateIso = todayAlmaty();
  const fields = { ...ai.fields, dateUnterschriftDatum: ai.fields.dateUnterschriftDatum || toGermanDate(dateIso) };
  const bytes = await buildDeclarationPdf(fields);
  const surname = (fields.txtfPersonNachname || "client").replace(/[^A-Za-z0-9-]/g, "");
  const name = `ZAV-Declaration-${surname}-${toGermanDate(dateIso)}.pdf`;
  const stored = await saveFile(`${cab._id}/declaration.pdf`, Buffer.from(bytes), "application/pdf");
  const file: StoredFile = { path: stored, name, contentType: "application/pdf", size: bytes.length, uploadedAt: new Date().toISOString() };

  const previous = cab.files?.declaration?.path;
  // Rebuilding the declaration never moves a cabinet back from later stages (signed, ZAV, done).
  const nextStatus = !cab.status || cab.status === "waiting_data" ? "declaration_ready" : cab.status;
  // Fields the team corrected stay exactly as the team wrote them.
  const edited = new Set(cab.teamEdited ?? []);
  const anketa = Object.fromEntries(
    Object.entries(anketaFromDeclaration(fields))
      .filter(([k]) => !edited.has(k))
      .map(([k, v]) => [`data.${k}`, v])
  );
  await patchCabinet(cab._id, { ...anketa, "files.declaration": file, declarationDate: dateIso, status: nextStatus });
  if (previous && previous !== stored) await deleteFile(previous);
  return file;
}

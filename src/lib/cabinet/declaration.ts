import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { FERIENJOB_FULL_SECTIONS, toGermanDate } from "./fields";
import { DECLARATION_PDF_KEYS, type AiCheck, type DeclarationFields } from "@/lib/ai/declaration";
import { deleteFile, saveFile } from "./storage";
import { patchCabinet, type Cabinet, type StoredFile } from "./server";

// Official one-page BA form "Declaration of Certificate of Enrolment – Vacation Job" (08/2025),
// emptied of any sample data. Fields keep their original names; the yes/no radio uses "ja"/"nein".
const BLANK = path.join(process.cwd(), "src", "assets", "zav-declaration-blank.pdf");

/** Today in Kazakhstan, as YYYY-MM-DD. */
export function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

/** Fills the official form with the AI's data (keys = PDF field names, dates DD.MM.YYYY). */
export async function buildDeclarationPdf(fields: DeclarationFields): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fs.readFile(BLANK));
  const form = doc.getForm();
  for (const key of DECLARATION_PDF_KEYS) {
    const v = (fields[key] ?? "").trim();
    if (key === "rbtnStudiumFortsetzung") form.getRadioGroup(key).select(/^(no|nein|нет)$/i.test(v) ? "nein" : "ja");
    else form.getTextField(key).setText(v);
  }
  form.flatten();
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
  const anketa = Object.fromEntries(Object.entries(anketaFromDeclaration(fields)).map(([k, v]) => [`data.${k}`, v]));
  await patchCabinet(cab._id, { ...anketa, "files.declaration": file, declarationDate: dateIso, status: nextStatus });
  if (previous && previous !== stored) await deleteFile(previous);
  return file;
}

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { CABINET_FIELDS, toGermanDate, validateCabinetData, type CabinetData } from "./fields";
import { deleteFile, saveFile } from "./storage";
import { patchCabinet, type Cabinet, type StoredFile } from "./server";

// Official one-page BA form "Declaration of Certificate of Enrolment – Vacation Job" (08/2025),
// emptied of any sample data. Fields keep their original names; the yes/no radio uses "ja"/"nein".
const BLANK = path.join(process.cwd(), "src", "assets", "zav-declaration-blank.pdf");

/** Today in Kazakhstan, as YYYY-MM-DD. */
export function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

export async function buildDeclarationPdf(data: CabinetData, dateIso: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fs.readFile(BLANK));
  const form = doc.getForm();
  for (const f of CABINET_FIELDS) {
    if (!f.pdf) continue;
    const v = (data[f.key] ?? "").trim();
    if (f.kind === "yesno") form.getRadioGroup(f.pdf).select(v === "no" ? "nein" : "ja");
    else form.getTextField(f.pdf).setText(f.kind === "date" && v ? toGermanDate(v) : v);
  }
  // 19 Location = university city, 20 Date = the day the declaration is made.
  form.getTextField("txtfUnterschriftOrt").setText((data.uniCity ?? "").trim());
  form.getTextField("dateUnterschriftDatum").setText(toGermanDate(dateIso));
  form.flatten();
  return doc.save();
}

/**
 * Builds the declaration from the cabinet's questionnaire, stores it privately and attaches it to the cabinet.
 * Throws if the questionnaire is incomplete.
 */
export async function generateDeclaration(cab: Cabinet): Promise<StoredFile> {
  const data = cab.data ?? {};
  const errors = validateCabinetData(data);
  if (Object.keys(errors).length) {
    throw new Error(`Анкета заполнена не полностью: ${Object.keys(errors).join(", ")}`);
  }
  const dateIso = todayAlmaty();
  const bytes = await buildDeclarationPdf(data, dateIso);
  const surname = (data.lastName ?? "client").replace(/[^A-Za-z0-9-]/g, "");
  const name = `ZAV-Declaration-${surname}-${toGermanDate(dateIso)}.pdf`;
  const stored = await saveFile(`${cab._id}/declaration.pdf`, Buffer.from(bytes), "application/pdf");
  const file: StoredFile = { path: stored, name, contentType: "application/pdf", size: bytes.length, uploadedAt: new Date().toISOString() };

  const previous = cab.files?.declaration?.path;
  // Rebuilding the declaration never moves a cabinet back from later stages (signed, ZAV, done).
  const nextStatus = !cab.status || cab.status === "waiting_data" ? "declaration_ready" : cab.status;
  await patchCabinet(cab._id, { "files.declaration": file, declarationDate: dateIso, status: nextStatus });
  if (previous && previous !== stored) await deleteFile(previous);
  return file;
}

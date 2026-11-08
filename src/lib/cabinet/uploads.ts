import "server-only";
import type { NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES, type FileKind } from "./fields";
import { deleteFile, saveFile } from "./storage";
import type { Cabinet, StoredFile } from "./server";

/** Detects the real file type from its first bytes (the browser-provided type can't be trusted). */
function sniff(buf: Buffer): { type: string; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { type: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "image/png", ext: "png" };
  return null;
}

export type UploadResult = { ok: true; buf: Buffer; type: string; ext: string } | { ok: false; error: string; status: number };

/** Reads the "file" field of a multipart request: size limit and a PDF/JPG/PNG check by content. */
export async function readUpload(req: NextRequest): Promise<UploadResult> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return { ok: false, error: "too_large", status: 413 };
  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    file = f instanceof File ? f : null;
  } catch {
    return { ok: false, error: "bad_request", status: 400 };
  }
  return checkFile(file);
}

/** Like readUpload, but also returns the other form fields; the file is optional. */
export async function readUploadForm(req: NextRequest): Promise<{ form: FormData | null; upload: UploadResult | null }> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return { form: null, upload: { ok: false, error: "too_large", status: 413 } };
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { form: null, upload: { ok: false, error: "bad_request", status: 400 } };
  }
  const f = form.get("file");
  const file = f instanceof File && f.size > 0 ? f : null;
  return { form, upload: file ? await checkFile(file) : null };
}

async function checkFile(file: File | null): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "no_file", status: 400 };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "too_large", status: 413 };
  const buf = Buffer.from(await file.arrayBuffer());
  const real = sniff(buf);
  if (!real) return { ok: false, error: "bad_type", status: 415 };
  return { ok: true, buf, ...real };
}

/** Stores the file privately and returns its record. The caller saves it on the cabinet, then calls `cleanup`. */
export async function storeCabinetFile(cab: Cabinet, kind: FileKind, up: { buf: Buffer; type: string; ext: string }) {
  const path = await saveFile(`${cab._id}/${kind}.${up.ext}`, up.buf, up.type);
  const file: StoredFile = { path, name: `${kind}.${up.ext}`, contentType: up.type, size: up.buf.length, uploadedAt: new Date().toISOString() };
  const previous = cab.files?.[kind]?.path;
  return { file, cleanup: async () => (previous && previous !== path ? deleteFile(previous) : undefined) };
}

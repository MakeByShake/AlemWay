import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { MAX_UPLOAD_BYTES, UPLOAD_KINDS, type UploadKind } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, currentCabinet, displayName, patchCabinet, type StoredFile } from "@/lib/cabinet/server";
import { deleteFile, saveFile } from "@/lib/cabinet/storage";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Detects the real file type from its first bytes (the browser-provided type can't be trusted). */
function sniff(buf: Buffer): { type: string; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { type: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "image/png", ext: "png" };
  return null;
}

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);

  const kind = req.nextUrl.searchParams.get("kind") as UploadKind | null;
  if (!kind || !UPLOAD_KINDS.includes(kind)) return fail("bad_kind");

  const locked = cab.status === "signed_uploaded" || cab.status === "done";
  if (kind === "signed") {
    if (!cab.files?.declaration?.path) return fail("no_declaration", 409);
    if (cab.status === "done") return fail("locked", 409);
  } else if (locked) {
    return fail("locked", 409);
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return fail("too_large", 413);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail("bad_request");
  }
  if (!file || file.size === 0) return fail("no_file");
  if (file.size > MAX_UPLOAD_BYTES) return fail("too_large", 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const real = sniff(buf);
  if (!real) return fail("bad_type", 415);

  const pathname = await saveFile(`${cab._id}/${kind}.${real.ext}`, buf, real.type);
  const stored: StoredFile = {
    path: pathname,
    name: `${kind}.${real.ext}`,
    contentType: real.type,
    size: buf.length,
    uploadedAt: new Date().toISOString(),
  };

  const set: Record<string, unknown> = { [`files.${kind}`]: stored };
  if (kind === "signed") Object.assign(set, { status: "signed_uploaded", signedAt: stored.uploadedAt });
  await patchCabinet(cab._id, set);

  const previous = cab.files?.[kind]?.path;
  if (previous && previous !== pathname) await deleteFile(previous);

  if (kind === "signed") {
    await sendTelegram([
      "<b>✅ Подписанная декларация загружена</b>",
      "",
      `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
      "Деканат поставил подпись и печать — декларацию можно забирать.",
      "",
      `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть кабинет в админке</a>`,
    ]);
  }

  return NextResponse.json({ ok: true, file: { name: stored.name, size: stored.size, uploadedAt: stored.uploadedAt } });
}

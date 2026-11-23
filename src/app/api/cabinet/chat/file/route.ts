import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { isSameOrigin } from "@/lib/http";
import { SERVICE_FILES, UPLOAD_KINDS, serviceOf, type UploadKind } from "@/lib/cabinet/fields";
import { currentCabinet, getCabinet, patchCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";
import { saveFile } from "@/lib/cabinet/storage";
import { lockReason } from "@/lib/cabinet/upload-rules";
import { readUploadForm, storeCabinetFile } from "@/lib/cabinet/uploads";
import { attachmentName, chatEvent, getChat, postClientFile } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// Per-cabinet limit (per server instance): 40 files per hour.
const hits = new Map<string, number[]>();
function limited(id: string) {
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(id, list);
  if (hits.size > 2000) hits.clear();
  return list.length > 40;
}

/**
 * The client sends a file in the chat and says what it is. A document (passport, certificate, signed
 * declaration…) goes straight into the cabinet's documents; «other» is kept with the chat for the team.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  if (limited(cab._id)) return fail("too_many", 429);
  const kind = req.nextUrl.searchParams.get("kind") ?? "other";

  if (kind !== "other") {
    const doc = kind as UploadKind;
    if (!UPLOAD_KINDS.includes(doc) || !SERVICE_FILES[serviceOf(cab.service)].client.includes(doc)) return fail("bad_kind");
    const locked = lockReason(cab, doc);
    if (locked) return fail(locked, 409);
  }
  const { form, upload } = await readUploadForm(req);
  if (!upload) return fail("no_file");
  if (!upload.ok) return fail(upload.error, upload.status);

  if (kind === "other") {
    const picked = form?.get("file");
    const name = attachmentName(picked instanceof File ? picked.name : undefined, upload.ext);
    const path = await saveFile(`${cab._id}/chat-${randomUUID()}.${upload.ext}`, upload.buf, upload.type);
    await postClientFile(cab, { file: { path, name, contentType: upload.type, size: upload.buf.length } });
    return NextResponse.json({ ok: true });
  }

  const doc = kind as UploadKind;
  const { file, cleanup } = await storeCabinetFile(cab, doc, upload);
  await patchCabinet(cab._id, { [`files.${doc}`]: file });
  await cleanup();
  await postClientFile(cab, { doc });
  // Both signed copies are in: the client still has to press «Отправить» in the cabinet (they check the scans first).
  if ((doc === "signed" || doc === "signed2") && cab.status === "declaration_ready") {
    const now = await getCabinet(cab._id);
    if (now?.files?.signed?.path && now.files.signed2?.path) await chatEvent(cab._id, "signed_both", { action: "cabinet", silent: true });
  }
  return NextResponse.json({ ok: true });
}

/** The client downloads a file that was sent in the chat (their own, or one the team sent them). */
export async function GET(req: NextRequest) {
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const chat = await getChat(cab._id);
  const m = chat?.messages.find((x) => x._key === key && x.kind !== "note");
  if (!m?.file) return fail("not_found", 404);
  return fileResponse({ ...m.file, uploadedAt: m.at }, { inline: req.nextUrl.searchParams.get("view") === "1" });
}

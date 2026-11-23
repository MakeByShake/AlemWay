import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { SERVICE_FILES, UPLOAD_KINDS, serviceOf, type UploadKind } from "@/lib/cabinet/fields";
import { currentCabinet, patchCabinet } from "@/lib/cabinet/server";
import { lockReason } from "@/lib/cabinet/upload-rules";
import { deleteFile } from "@/lib/cabinet/storage";
import { readUpload, storeCabinetFile } from "@/lib/cabinet/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function clientKind(req: NextRequest) {
  const cab = await currentCabinet();
  if (!cab) return { error: fail("unauthorized", 401) } as const;
  const kind = req.nextUrl.searchParams.get("kind") as UploadKind | null;
  if (!kind || !UPLOAD_KINDS.includes(kind) || !SERVICE_FILES[serviceOf(cab.service)].client.includes(kind)) return { error: fail("bad_kind") } as const;
  return { cab, kind } as const;
}

/** Client uploads: passport and certificate while filling in, then the signed declaration. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const r = await clientKind(req);
  if ("error" in r) return r.error;
  const { cab, kind } = r;
  const locked = lockReason(cab, kind);
  if (locked) return fail(locked, 409);

  const up = await readUpload(req);
  if (!up.ok) return fail(up.error, up.status);
  const { file, cleanup } = await storeCabinetFile(cab, kind, up);

  // The signed declaration is only stored here; the client then presses «Отправить декларацию с печатью».
  await patchCabinet(cab._id, { [`files.${kind}`]: file });
  await cleanup();

  return NextResponse.json({ ok: true, file: { name: file.name, size: file.size, uploadedAt: file.uploadedAt } });
}

/** Client deletes their own file (a wrong photo, an old certificate) while they could replace it anyway. */
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const r = await clientKind(req);
  if ("error" in r) return r.error;
  const { cab, kind } = r;
  const locked = lockReason(cab, kind, true);
  if (locked) return fail(locked, 409);
  const path = cab.files?.[kind]?.path;
  await patchCabinet(cab._id, {}, [`files.${kind}`]);
  if (path) await deleteFile(path).catch(() => null);
  return NextResponse.json({ ok: true });
}

import { type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { FILE_KINDS, type FileKind } from "@/lib/cabinet/fields";
import { getCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager downloads a client's file from the Studio. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = (req.nextUrl.searchParams.get("id") ?? "").replace(/^drafts\./, "");
  const kind = req.nextUrl.searchParams.get("kind") as FileKind;
  if (!id.startsWith("cabinets.") || !FILE_KINDS.includes(kind)) return adminError("Некорректный запрос");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Кабинет не найден", 404);
  return fileResponse(cab.files?.[kind]);
}

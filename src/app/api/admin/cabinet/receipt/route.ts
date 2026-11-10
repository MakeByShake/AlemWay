import { type NextRequest } from "next/server";
import { adminAccess, adminError, canSeeCabinet } from "@/lib/admin-auth";
import { getCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager downloads a payment receipt. */
export async function GET(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return adminError("Клиент не найден", 404);
  if (!canSeeCabinet(access, cab)) return adminError("Этот клиент закреплён за другим менеджером", 403);
  return fileResponse(cab.payments?.find((p) => p._key === key)?.receipt, { inline: req.nextUrl.searchParams.get("view") === "1" });
}

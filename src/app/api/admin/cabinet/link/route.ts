import { NextResponse, type NextRequest } from "next/server";
import { adminAccess, adminError, canSeeCabinet } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { getCabinet, newLoginToken, patchCabinet } from "@/lib/cabinet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Issues a new login link for an existing cabinet. The previous link stops working. */
export async function POST(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const body = await readJsonObject(req, 1024);
  const id = typeof body?.id === "string" ? body.id.replace(/^drafts\./, "") : "";
  if (!id.startsWith("cabinets.")) return adminError("Некорректный кабинет");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Кабинет не найден", 404);
  if (!canSeeCabinet(access, cab)) return adminError("Этот клиент закреплён за другим менеджером", 403);

  const { hash, link } = newLoginToken();
  await patchCabinet(id, { tokenHash: hash, linkCreatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, link });
}

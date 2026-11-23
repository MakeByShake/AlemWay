import { NextResponse, type NextRequest } from "next/server";
import { readJsonObject } from "@/lib/http";
import { adminError } from "@/lib/admin-auth";
import { chatStaff } from "@/lib/chat/admin";
import { getChat, resolveChat } from "@/lib/chat/server";
import { isCabinetId } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «Решено»: the client's question is closed, the assistant answers new questions again. */
export async function POST(req: NextRequest) {
  const me = await chatStaff(req, true);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  if (!me.full) return adminError("Отдел продаж может только читать чаты своих клиентов.", 403);
  const id = (await readJsonObject(req, 1024))?.id;
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  const chat = await getChat(id);
  if (!chat) return adminError("Чат не найден", 404);
  if (chat.mode === "human" || chat.waiting) await resolveChat(id, me);
  return NextResponse.json({ ok: true });
}

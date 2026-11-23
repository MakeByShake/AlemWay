import { NextResponse, type NextRequest } from "next/server";
import { readJsonObject } from "@/lib/http";
import { adminError } from "@/lib/admin-auth";
import { chatStaff } from "@/lib/chat/admin";
import { getChat, markRead } from "@/lib/chat/server";
import { isCabinetId } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A team member opened the chat: its counter of new messages goes to zero for everyone. */
export async function POST(req: NextRequest) {
  const me = await chatStaff(req, true);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  // «Отдел продаж» only reads: looking at a chat changes nothing for the others.
  if (!me.full) return NextResponse.json({ ok: true });
  const id = (await readJsonObject(req, 1024))?.id;
  if (!isCabinetId(id)) return adminError("Некорректный запрос");
  const chat = await getChat(id);
  if (chat && chat.unreadStaff > 0) await markRead(id, "staff");
  return NextResponse.json({ ok: true });
}

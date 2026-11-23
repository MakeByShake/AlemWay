import { NextResponse, type NextRequest } from "next/server";
import { adminError } from "@/lib/admin-auth";
import { chatCounts, chatStaff, listChats, type ChatTab } from "@/lib/chat/admin";
import { INBOX, liveUrl } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The list of chats for the team: a tab («Ждут ответа», «Мои», «Все») or a search by name, phone or number. */
export async function GET(req: NextRequest) {
  const me = await chatStaff(req);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const t = req.nextUrl.searchParams.get("tab");
  const tab: ChatTab = t === "mine" || t === "all" ? t : "waiting";
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  const [rows, counts] = await Promise.all([listChats(me, { tab, q }), chatCounts(me)]);
  return NextResponse.json({ ok: true, rows, counts, live: liveUrl(INBOX) }, { headers: { "Cache-Control": "no-store" } });
}

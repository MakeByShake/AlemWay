import { NextResponse, type NextRequest } from "next/server";
import { adminError } from "@/lib/admin-auth";
import { chatCounts, chatStaff } from "@/lib/chat/admin";
import { INBOX, liveUrl } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The number on «Чаты» in the menu: how many clients wait for a person. */
export async function GET(req: NextRequest) {
  const me = await chatStaff(req);
  if (!me) return adminError("Нет доступа. Войдите в админку заново.", 401);
  return NextResponse.json({ ok: true, ...(await chatCounts(me)), live: liveUrl(INBOX) }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { currentCabinet } from "@/lib/cabinet/server";
import { getChat, markRead } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The client opened the chat: new messages count as read (the team sees «Прочитано»). */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const chat = await getChat(cab._id);
  if (chat && chat.unreadClient > 0) await markRead(cab._id, "client");
  return NextResponse.json({ ok: true });
}

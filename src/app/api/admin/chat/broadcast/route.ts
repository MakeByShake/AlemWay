import { NextResponse, type NextRequest } from "next/server";
import { readJsonObject } from "@/lib/http";
import { adminError } from "@/lib/admin-auth";
import { writeClient } from "@/lib/cabinet/server";
import { broadcastRecipients, chatStaff, listBroadcasts } from "@/lib/chat/admin";
import { sendBroadcast } from "@/lib/chat/server";
import { STAFF_TEXT_MAX, isCabinetId } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_LOGIN = () => adminError("Нет доступа. Войдите в админку заново.", 401);
const NO_RIGHTS = () => adminError("Рассылку делают владелец и менеджеры.", 403);

/**
 * `?preview=1` + filter — who would get a message (nothing is sent).
 * Without it — the broadcasts already sent, with who has read them.
 */
export async function GET(req: NextRequest) {
  const me = await chatStaff(req);
  if (!me) return NO_LOGIN();
  if (!me.full) return NO_RIGHTS();
  const p = req.nextUrl.searchParams;
  if (p.get("preview") !== "1") return NextResponse.json({ ok: true, sent: await listBroadcasts() }, { headers: { "Cache-Control": "no-store" } });
  const partyOf = p.get("partyOf");
  const recipients = await broadcastRecipients(me, {
    status: p.get("status") ?? "",
    missing: p.get("missing") ?? "",
    service: p.get("service") ?? "",
    mine: p.get("mine") === "1",
    partyOf: isCabinetId(partyOf) ? partyOf : undefined,
  });
  return NextResponse.json({ ok: true, recipients }, { headers: { "Cache-Control": "no-store" } });
}

/** Sends one message into the chats of the chosen clients. Only by hand, only by the owner or a manager. */
export async function POST(req: NextRequest) {
  const me = await chatStaff(req, true);
  if (!me) return NO_LOGIN();
  if (!me.full) return NO_RIGHTS();
  const body = await readJsonObject(req, 256 * 1024);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, STAFF_TEXT_MAX) : "";
  const asked = Array.isArray(body?.ids) ? [...new Set(body.ids.filter(isCabinetId))].slice(0, 500) : [];
  if (!text) return adminError("Напишите сообщение");
  if (!asked.length) return adminError("Выберите хотя бы одного клиента");
  // Only clients that really exist get the message.
  const ids = await writeClient().fetch<string[]>(`*[_type == "cabinet" && _id in $ids]._id`, { ids: asked });
  if (!ids.length) return adminError("Клиенты не найдены", 404);
  const filter = typeof body?.filter === "string" ? body.filter.slice(0, 200) : "";
  const id = await sendBroadcast(me, ids, text, filter);
  return NextResponse.json({ ok: true, id, sent: ids.length });
}

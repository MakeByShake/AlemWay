import { NextResponse, type NextRequest } from "next/server";
import { writeClient } from "@/lib/cabinet/server";
import { chatEvent } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Days before the deadline when the client gets a reminder in the chat (and on the phone). */
const WHEN = [3, 1, 0];

/**
 * Once a day (Vercel Cron, 09:00 Almaty): clients who still hand in documents get a reminder
 * 3 days, 1 day and on the last day before their deadline. Each reminder is sent once.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const dates = WHEN.map(day);
  const c = writeClient();
  const rows = await c.fetch<{ _id: string; deadline: string }[]>(
    `*[_type == "cabinet" && !(_id in path("drafts.**")) && deadline in $dates && coalesce(status, "waiting_data") in ["waiting_data", "declaration_ready"]]{_id, deadline}`,
    { dates }
  );
  const done = await c.fetch<{ cabinet: string; args: string[] | null }[]>(`*[_type == "chat" && cabinet in $ids]{cabinet, "args": messages[event == "deadline_soon"].arg}`, { ids: rows.map((r) => r._id) });
  const remindedOf = new Map(done.map((d) => [d.cabinet, d.args ?? []]));
  let sent = 0;
  for (const r of rows) {
    const days = WHEN[dates.indexOf(r.deadline)];
    const arg = `${r.deadline}|${days}`;
    if (remindedOf.get(r._id)?.includes(arg)) continue;
    await chatEvent(r._id, "deadline_soon", { arg });
    sent++;
  }
  return NextResponse.json({ ok: true, today, checked: rows.length, sent });
}

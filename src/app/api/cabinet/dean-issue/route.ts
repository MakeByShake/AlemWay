import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { cabinetAdminUrl, currentCabinet, displayName, managerLine, patchCabinet, type DeanIssue } from "@/lib/cabinet/server";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The dean's office won't sign and stamp the declaration: the client tells us where and why, the team takes over. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await readJsonObject(req, 8 * 1024);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const issue: DeanIssue = {
    uni: str(body.uni, 200),
    faculty: str(body.faculty, 200),
    group: str(body.group, 60),
    reason: str(body.reason, 1500),
    phone: str(body.phone, 60) || undefined,
    at: new Date().toISOString(),
  };
  const missing = (["uni", "faculty", "group", "reason"] as const).filter((k) => !issue[k]);
  if (missing.length) return NextResponse.json({ ok: false, error: "invalid", missing }, { status: 422 });

  await patchCabinet(cab._id, { deanIssue: issue });
  await sendTelegram([
    "<b>⚠️ Деканат не ставит подпись и печать</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
    managerLine(cab),
    `<b>Вуз:</b> ${escapeHtml(issue.uni)}`,
    `<b>Факультет:</b> ${escapeHtml(issue.faculty)}`,
    `<b>Группа:</b> ${escapeHtml(issue.group)}`,
    issue.phone ? `<b>Телефон деканата:</b> ${escapeHtml(issue.phone)}` : "",
    "",
    `<b>Почему:</b> ${escapeHtml(issue.reason)}`,
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть клиента в админке</a>`,
  ]);
  return NextResponse.json({ ok: true, issue });
}

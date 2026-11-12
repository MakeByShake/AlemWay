import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { cabinetAdminUrl, currentCabinet, displayName, managerLine, patchCabinet } from "@/lib/cabinet/server";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Client sends the declaration with the dean's signature and stamp → the team takes over. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  // The new form (06/2026) goes in 2 signed copies.
  if (!cab.files?.signed?.path || !cab.files?.signed2?.path) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  if (cab.status !== "declaration_ready") return NextResponse.json({ ok: true, already: true });

  await patchCabinet(cab._id, { status: "signed_uploaded", signedAt: new Date().toISOString() });
  await sendTelegram([
    "<b>✅ Клиент сдал декларацию с печатью</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
    managerLine(cab),
    "Деканат поставил подпись и печать. Следующий этап: проверить и отправить документы партнёру.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть клиента в админке</a>`,
  ]);
  return NextResponse.json({ ok: true });
}

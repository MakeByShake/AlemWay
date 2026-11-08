import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { cabinetAdminUrl, currentCabinet, displayName, managerLine } from "@/lib/cabinet/server";
import { readUploadForm } from "@/lib/cabinet/uploads";
import { addPayment, saveReceipt } from "@/lib/cabinet/payments-server";
import { formatTenge, parseAmount, paymentTotals } from "@/lib/cabinet/payments";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Client attaches a payment receipt with the amount. The manager confirms it in the admin. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  if ((cab.payments ?? []).filter((p) => p.status === "pending").length >= 5) return fail("too_many", 429);

  const { form, upload } = await readUploadForm(req);
  if (!upload) return fail("no_file");
  if (!upload.ok) return fail(upload.error, upload.status);
  const amount = parseAmount(form?.get("amount"));
  if (!amount) return fail("bad_amount");
  const paidAtRaw = String(form?.get("paidAt") ?? "");
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw) ? paidAtRaw : new Date().toISOString().slice(0, 10);

  const receipt = await saveReceipt(cab._id, upload);
  await addPayment(cab._id, { amount, paidAt, method: "kaspi", receipt, status: "pending", by: "client", byName: "Клиент" });

  const t = paymentTotals(cab.price, cab.payments);
  await sendTelegram([
    "<b>💳 Клиент прикрепил чек</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
    managerLine(cab),
    `<b>Сумма в чеке:</b> ${formatTenge(amount)}`,
    t.hasPrice ? `<b>К оплате всего:</b> ${formatTenge(t.price)}, подтверждено ${formatTenge(t.paid)}` : "Сумма к оплате ещё не указана в админке.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Проверить и подтвердить</a>`,
  ]);
  return NextResponse.json({ ok: true });
}

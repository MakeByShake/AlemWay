import { NextResponse, type NextRequest } from "next/server";
import { adminAccess, adminError, canSeeCabinet } from "@/lib/admin-auth";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin/session";
import { getCabinet } from "@/lib/cabinet/server";
import { readUploadForm } from "@/lib/cabinet/uploads";
import { addPayment, saveReceipt } from "@/lib/cabinet/payments-server";
import { PAYMENT_METHODS, formatTenge, parseAmount, type PaymentMethod } from "@/lib/cabinet/payments";
import { logActivity } from "@/lib/admin/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager adds a payment (cash, transfer, Kaspi), optionally with a receipt. Counts as confirmed. */
export async function POST(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const me = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value).catch(() => null);

  const { form, upload } = await readUploadForm(req);
  if (!form) return adminError("Не удалось прочитать форму");
  if (upload && !upload.ok) return adminError(upload.error === "too_large" ? "Файл больше 4 МБ" : "Подойдёт только PDF, JPG или PNG");
  const id = String(form.get("id") ?? "");
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return adminError("Клиент не найден", 404);
  if (!canSeeCabinet(access, cab)) return adminError("Этот клиент закреплён за другим сотрудником", 403);
  const amount = parseAmount(form.get("amount"));
  if (!amount) return adminError("Укажите сумму");
  const methodRaw = String(form.get("method") ?? "");
  const method = (PAYMENT_METHODS.some((m) => m.value === methodRaw) ? methodRaw : "other") as PaymentMethod;
  const paidAtRaw = String(form.get("paidAt") ?? "");
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw) ? paidAtRaw : new Date().toISOString().slice(0, 10);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);

  const receipt = upload?.ok ? await saveReceipt(id, upload) : undefined;
  await addPayment(id, {
    amount,
    method,
    paidAt,
    ...(note ? { note } : {}),
    ...(receipt ? { receipt } : {}),
    // «Отдел продаж» payments wait for confirmation.
    status: access.full ? "confirmed" : "pending",
    by: me?.login ?? "manager",
    byName: me?.name ?? "Менеджер",
  });
  await logActivity(me, "payment", `добавил(а) оплату ${formatTenge(amount)}${access.full ? "" : " (ждёт подтверждения)"}`, cab);
  return NextResponse.json({ ok: true });
}

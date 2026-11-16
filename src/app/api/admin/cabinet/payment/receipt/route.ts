import { NextResponse, type NextRequest } from "next/server";
import { adminAccess, adminError, canSeeCabinet } from "@/lib/admin-auth";
import { getCabinet } from "@/lib/cabinet/server";
import { readUploadForm } from "@/lib/cabinet/uploads";
import { addReceipt, saveReceipt } from "@/lib/cabinet/payments-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Adds one more receipt to an existing payment. */
export async function POST(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const { form, upload } = await readUploadForm(req);
  if (!form) return adminError("Не удалось прочитать форму");
  if (!upload) return adminError("Выберите файл чека");
  if (!upload.ok) return adminError(upload.error === "too_large" ? "Файл больше 4 МБ" : "Подойдёт только PDF, JPG или PNG");
  const id = String(form.get("id") ?? "");
  const key = String(form.get("key") ?? "");
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return adminError("Клиент не найден", 404);
  if (!canSeeCabinet(access, cab)) return adminError("Этот клиент закреплён за другим сотрудником", 403);
  if (!cab.payments?.some((p) => p._key === key)) return adminError("Платёж не найден", 404);
  await addReceipt(id, key, await saveReceipt(id, upload));
  return NextResponse.json({ ok: true });
}

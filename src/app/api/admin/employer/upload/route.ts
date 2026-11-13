import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminAccess, adminError } from "@/lib/admin-auth";
import { logActivity } from "@/lib/admin/activity";
import { getEmployer, type EmployerFile } from "@/lib/admin/employers";
import { writeClient } from "@/lib/cabinet/server";
import { saveFile } from "@/lib/cabinet/storage";
import { readUpload } from "@/lib/cabinet/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  too_large: "Файл больше 4 МБ — сожмите его.",
  bad_type: "Подойдёт только PDF, JPG или PNG.",
  no_file: "Файл не выбран.",
  bad_request: "Не удалось прочитать файл.",
};

/** Adds a document to an employer card (contract, price list, photos of the housing…). */
export async function POST(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  if (!access.full) return adminError("Нет прав: отдел продаж может только смотреть.", 403);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const label = (req.nextUrl.searchParams.get("label") ?? "").trim().slice(0, 80) || "Документ";
  if (!/^employers\.[\w-]+$/.test(id)) return adminError("Некорректный запрос");
  const emp = await getEmployer(id);
  if (!emp) return adminError("Работодатель не найден", 404);

  const up = await readUpload(req);
  if (!up.ok) return adminError(ERRORS[up.error] ?? "Ошибка загрузки", up.status);
  const key = randomUUID().slice(0, 12);
  const safe = label.replace(/[^\wА-Яа-яЁё-]+/g, "-").slice(0, 40) || "file";
  const path = await saveFile(`${id}/${key}.${up.ext}`, up.buf, up.type);
  const file: EmployerFile = { _key: key, label, path, name: `${safe}.${up.ext}`, contentType: up.type, size: up.buf.length, uploadedAt: new Date().toISOString() };
  await writeClient().patch(id).setIfMissing({ files: [] }).append("files", [file]).commit({ visibility: "sync" });
  await logActivity({ login: access.login }, "employer", `загрузил(а) «${label}» работодателю ${emp.name ?? ""}`);
  return NextResponse.json({ ok: true });
}

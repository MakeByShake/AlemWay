import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { getCabinet } from "@/lib/cabinet/server";
import { generateDeclaration } from "@/lib/cabinet/declaration";
import { validateCabinetData, CABINET_FIELDS, serviceOf } from "@/lib/cabinet/fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager rebuilds the declaration from the published questionnaire (date = today). */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await readJsonObject(req, 1024);
  const id = typeof body?.id === "string" ? body.id.replace(/^drafts\./, "") : "";
  if (!id.startsWith("cabinets.")) return adminError("Некорректный кабинет");

  const cab = await getCabinet(id);
  if (!cab) return adminError("Кабинет не найден", 404);
  if (serviceOf(cab.service) !== "ferienjob") return adminError("Декларация ZAV есть только у кабинетов Ferienjob");
  const errors = validateCabinetData(cab.data ?? {});
  if (Object.keys(errors).length) {
    const names = Object.keys(errors).map((k) => CABINET_FIELDS.find((f) => f.key === k)?.label.ru ?? k);
    return adminError(`Не заполнено или с ошибкой: ${names.join("; ")}`, 422);
  }
  await generateDeclaration(cab);
  return NextResponse.json({ ok: true });
}

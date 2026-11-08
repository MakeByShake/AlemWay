import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { SERVICE_FILES, sanitizeCabinetData, serviceOf, validateCabinetData } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, managerLine, currentCabinet, displayName, getCabinet, patchCabinet } from "@/lib/cabinet/server";
import { generateDeclaration } from "@/lib/cabinet/declaration";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PURPOSE_RU: Record<string, string> = {
  tourism: "туризм",
  family: "к родственникам/друзьям",
  business: "деловая",
  event: "мероприятие",
  medical: "лечение",
  other: "другое",
};

/**
 * Saves the questionnaire. With submit=true it checks that everything is filled in, then:
 * Ferienjob — builds the ZAV declaration; K-ETA — hands the data to the manager to apply.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const service = serviceOf(cab.service);
  const status = cab.status ?? "waiting_data";
  const editable = status === "waiting_data" || (service === "ferienjob" && status === "declaration_ready");
  if (!editable) return NextResponse.json({ ok: false, error: "locked" }, { status: 409 });

  const body = await readJsonObject(req, 16 * 1024);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const data = sanitizeCabinetData(body.data, service);
  const submit = body.submit === true;

  if (submit) {
    const errors = validateCabinetData(data, service);
    const missingFiles = SERVICE_FILES[service].requiredBeforeSubmit.filter((k) => !cab.files?.[k]?.path);
    if (Object.keys(errors).length || missingFiles.length) {
      await patchCabinet(cab._id, { data });
      return NextResponse.json({ ok: false, error: "invalid", errors, missingFiles }, { status: 422 });
    }
  }

  const now = new Date().toISOString();
  if (!submit) {
    await patchCabinet(cab._id, { data });
    return NextResponse.json({ ok: true, saved: true });
  }

  if (service === "keta") {
    await patchCabinet(cab._id, { data, submittedAt: now, status: "keta_applying" });
    await sendTelegram([
      "<b>🇰🇷 Анкета K-ETA заполнена — можно подавать</b>",
      "",
      `<b>Клиент:</b> ${escapeHtml(displayName({ ...cab, data }))}`,
      managerLine(cab),
      data.phone && `<b>Телефон:</b> ${escapeHtml(data.phone)}`,
      data.arrivalDate && `<b>Въезд:</b> ${escapeHtml(data.arrivalDate)} · <b>цель:</b> ${escapeHtml(PURPOSE_RU[data.purpose ?? ""] ?? "—")}`,
      "Подайте заявку на k-eta.go.kr и поставьте статус «K-ETA: подано».",
      "",
      `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть кабинет в админке</a>`,
    ]);
    return NextResponse.json({ ok: true, submitted: true });
  }

  await patchCabinet(cab._id, { data, submittedAt: now });
  const fresh = await getCabinet(cab._id);
  if (!fresh) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  try {
    await generateDeclaration(fresh);
  } catch (err) {
    console.error("[cabinet] declaration failed", err);
    return NextResponse.json({ ok: false, error: "declaration_failed" }, { status: 500 });
  }

  await sendTelegram([
    "<b>📝 Анкета Ferienjob заполнена — декларация готова</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(fresh))}`,
    managerLine(fresh),
    data.phone && `<b>Телефон:</b> ${escapeHtml(data.phone)}`,
    data.uniName && `<b>Вуз:</b> ${escapeHtml(data.uniName)}`,
    "Клиенту осталось подписать декларацию в деканате и загрузить скан.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть кабинет в админке</a>`,
  ]);
  return NextResponse.json({ ok: true, declaration: true });
}

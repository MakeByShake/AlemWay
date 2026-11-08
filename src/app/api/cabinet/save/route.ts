import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { NO_PASSPORT_REQUIRED, SERVICE_FILES, sanitizeCabinetData, serviceOf, validateCabinetData, type FieldError } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, managerLine, currentCabinet, displayName, getCabinet, patchCabinet } from "@/lib/cabinet/server";
import { checkAndBuildDeclaration, notifyAiFailed } from "@/lib/cabinet/ai-flow";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The AI reads the documents: usually 20–90 seconds.
export const maxDuration = 300;

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
    const errors: Record<string, FieldError> = validateCabinetData(data, service);
    // Ferienjob without a passport yet: the name in Latin and the date of birth are typed in.
    if (service === "ferienjob" && !cab.files?.passport?.path) {
      for (const k of NO_PASSPORT_REQUIRED) if (!data[k]?.trim() && !errors[k]) errors[k] = "required";
    }
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
  try {
    const ai = await checkAndBuildDeclaration(cab._id, "client");
    if (ai.status === "НЕ ГОТОВО") {
      return NextResponse.json({ ok: false, error: "not_ready", ai: { missing: ai.missing, clientMessage: ai.clientMessage } }, { status: 422 });
    }
    return NextResponse.json({ ok: true, declaration: true });
  } catch (err) {
    console.error("[cabinet] AI declaration failed", err);
    const fresh = await getCabinet(cab._id);
    if (fresh) await notifyAiFailed(fresh);
    return NextResponse.json({ ok: false, error: "ai_failed" }, { status: 503 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { sanitizeCabinetData, validateCabinetData } from "@/lib/cabinet/fields";
import { cabinetAdminUrl, currentCabinet, displayName, getCabinet, patchCabinet } from "@/lib/cabinet/server";
import { generateDeclaration } from "@/lib/cabinet/declaration";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saves the questionnaire. With submit=true it also checks that everything is filled in,
 * builds the ZAV declaration and notifies the team.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (cab.status === "signed_uploaded" || cab.status === "done") {
    return NextResponse.json({ ok: false, error: "locked" }, { status: 409 });
  }

  const body = await readJsonObject(req, 16 * 1024);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const data = sanitizeCabinetData(body.data);
  const submit = body.submit === true;

  if (submit) {
    const errors = validateCabinetData(data);
    const missingFiles = (["passport", "enrollment"] as const).filter((k) => !cab.files?.[k]?.path);
    if (Object.keys(errors).length || missingFiles.length) {
      await patchCabinet(cab._id, { data });
      return NextResponse.json({ ok: false, error: "invalid", errors, missingFiles }, { status: 422 });
    }
  }

  await patchCabinet(cab._id, submit ? { data, submittedAt: new Date().toISOString() } : { data });
  if (!submit) return NextResponse.json({ ok: true, saved: true });

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
    data.phone && `<b>Телефон:</b> ${escapeHtml(data.phone)}`,
    data.uniName && `<b>Вуз:</b> ${escapeHtml(data.uniName)}`,
    "Клиенту осталось подписать декларацию в деканате и загрузить скан.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть кабинет в админке</a>`,
  ]);
  return NextResponse.json({ ok: true, declaration: true });
}

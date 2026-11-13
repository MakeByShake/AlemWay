import "server-only";
import { aiReady, runDeclarationCheck, type AiCheck } from "@/lib/ai/declaration";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { saveAiDeclaration, teamOverrides, todayAlmaty } from "./declaration";
import { cabinetAdminUrl, displayName, getCabinet, managerLine, patchCabinet, type Cabinet } from "./server";

// ZAV allows at most 90 days of holidays: a longer summer is cut to 90 days (both days counted) instead of blocking.
const MAX_HOLIDAY_DAYS = 90;
function clampHolidays(fields: AiCheck["fields"]): string | null {
  const parse = (v: string) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v?.trim() ?? "");
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : NaN;
  };
  const from = parse(fields.dateStudiumFerienVon);
  const to = parse(fields.dateStudiumFerienBis);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  if ((to - from) / 86_400_000 + 1 <= MAX_HOLIDAY_DAYS) return null;
  const end = new Date(from + (MAX_HOLIDAY_DAYS - 1) * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const was = fields.dateStudiumFerienBis;
  fields.dateStudiumFerienBis = `${pad(end.getUTCDate())}.${pad(end.getUTCMonth() + 1)}.${end.getUTCFullYear()}`;
  return `Каникулы длиннее 90 дней (${fields.dateStudiumFerienVon}–${was}) — конец укорочен до ${fields.dateStudiumFerienBis}, проверить.`;
}

const list = (xs: string[]) => xs.slice(0, 8).map((x) => `• ${escapeHtml(x)}`);

/**
 * AI checks the documents. Ready → the declaration is made and the client can download it.
 * Not ready → the client sees what is missing. The result is stored on the cabinet for the manager.
 */
export async function checkAndBuildDeclaration(cabId: string, by: "client" | "manager"): Promise<AiCheck> {
  const cab = await getCabinet(cabId);
  if (!cab) throw new Error("cabinet not found");
  const ai = await runDeclarationCheck(cab, todayAlmaty());
  const ready = aiReady(ai.status);
  // What the team corrected in the questionnaire goes into the declaration as is.
  if (ready) {
    const over = teamOverrides(cab);
    const changed = Object.entries(over).filter(([k, v]) => ai.fields[k as keyof typeof ai.fields] !== v);
    if (changed.length) {
      Object.assign(ai.fields, over);
      ai.checks = [...ai.checks, `Взято из анкеты, исправленной командой: ${changed.map(([, v]) => v).join(", ")}`];
    }
    const cut = clampHolidays(ai.fields);
    if (cut) ai.checks = [...ai.checks, cut];
  }
  await patchCabinet(cab._id, { aiCheck: ai });

  if (ready) await saveAiDeclaration({ ...cab, aiCheck: ai } as Cabinet, ai);

  await sendTelegram([
    ready ? `<b>📝 ИИ сделал декларацию — ${ai.status}</b>` : "<b>⚠️ ИИ: декларацию выдать нельзя — НЕ ГОТОВО</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
    managerLine(cab),
    cab.data?.phone && `<b>Телефон:</b> ${escapeHtml(cab.data.phone)}`,
    ai.fields.txtfDritteName && `<b>Вуз:</b> ${escapeHtml(ai.fields.txtfDritteName)}`,
    by === "manager" ? "Проверку запустил менеджер." : "",
    ...(ai.missing.length ? ["", "<b>Чего не хватает:</b>", ...list(ai.missing)] : []),
    ...(ai.checks.length ? ["", "<b>Проверить:</b>", ...list(ai.checks)] : []),
    ready ? "\nКлиенту осталось подписать декларацию в деканате и загрузить скан." : "\nКлиент видит, что исправить, и отправит заново.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть клиента в админке</a>`,
  ]);
  return ai;
}

/** If the AI is down, the documents still reach the team. */
export async function notifyAiFailed(cab: Cabinet) {
  await sendTelegram([
    "<b>⚠️ ИИ не смог проверить документы</b>",
    "",
    `<b>Клиент:</b> ${escapeHtml(displayName(cab))}`,
    managerLine(cab),
    "Анкета и документы сохранены. Проверьте вручную или нажмите «Проверить ИИ заново» в админке.",
    "",
    `📋 <a href="${cabinetAdminUrl(cab._id)}">Открыть клиента в админке</a>`,
  ]);
}

export { patchCabinet };

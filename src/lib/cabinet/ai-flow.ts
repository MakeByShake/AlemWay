import "server-only";
import { aiReady, runDeclarationCheck, type AiCheck } from "@/lib/ai/declaration";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { saveAiDeclaration, todayAlmaty } from "./declaration";
import { cabinetAdminUrl, displayName, getCabinet, managerLine, patchCabinet, type Cabinet } from "./server";

const list = (xs: string[]) => xs.slice(0, 8).map((x) => `• ${escapeHtml(x)}`);

/**
 * AI checks the documents. Ready → the declaration is made and the client can download it.
 * Not ready → the client sees what is missing. The result is stored on the cabinet for the manager.
 */
export async function checkAndBuildDeclaration(cabId: string, by: "client" | "manager"): Promise<AiCheck> {
  const cab = await getCabinet(cabId);
  if (!cab) throw new Error("cabinet not found");
  const ai = await runDeclarationCheck(cab, todayAlmaty());
  await patchCabinet(cab._id, { aiCheck: ai });

  const ready = aiReady(ai.status);
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

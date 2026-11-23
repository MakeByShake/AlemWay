import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CABINET_FIELDS, CABINET_STATUSES, FILE_LABELS, SERVICE_FILES, serviceOf } from "@/lib/cabinet/fields";
import { displayName, type Cabinet } from "@/lib/cabinet/server";
import { ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import { recordUsage } from "@/lib/ai/usage";
import { FILE_SHORT, messageText } from "./texts";
import { CHAT_TEXT_MAX, type ChatMessage } from "./types";

/** The assistant ends its answer with this mark when a person has to take the question. The client never sees it. */
const HANDOFF = "[[CURATOR]]";
const MAX_TURNS = 30;

/** Context about this client, so the assistant can say what exactly is missing. */
function clientContext(cab: Cabinet) {
  const service = serviceOf(cab.service);
  const status = CABINET_STATUSES.find((s) => s.value === (cab.status ?? "waiting_data"))?.title ?? cab.status;
  const filled = CABINET_FIELDS.map((f) => `- ${f.label.ru}: ${cab.data?.[f.key] ? (f.kind === "yesno" ? (cab.data[f.key] === "no" ? "Нет" : "Да") : cab.data[f.key]) : "—"}`).join("\n");
  const files = SERVICE_FILES[service].all.map((k) => `- ${FILE_LABELS[k].ru}: ${cab.files?.[k]?.path ? "загружен" : "нет"}`).join("\n");
  const ai = cab.aiCheck;
  return [
    "## Контекст клиента (данные сайта, не от клиента)",
    `Имя: ${displayName(cab)}`,
    `Этап: ${status}`,
    cab.reform
      ? "Старый клиент: декларация раньше делалась вручную, теперь переоформляем её на новый бланк 06/2026 — анкета обнулена, клиент заполняет её заново. Если спросит «почему заново» — объясни по ответу «Почему нужно делать декларацию заново?»."
      : "",
    "",
    "Анкета:",
    filled,
    "",
    "Файлы:",
    files,
    "",
    `Статус декларации (декларационный отдел): ${ai ? ai.status : "ещё не проверялась"}`,
    ai?.missing.length ? `ЧЕГО НЕ ХВАТАЕТ:\n${ai.missing.map((m) => `- ${m}`).join("\n")}` : "",
    "",
    "Клиент уже оплатил услугу, в кабинет он заходит только чтобы оформить документы. Про оплату не напоминай; если спросит — к куратору.",
    "",
    "## Как устроен этот чат",
    "Чат общий: кроме тебя, клиенту здесь пишут кураторы AlemWay, а сайт присылает события по делу. В переписке такие сообщения стоят в квадратных скобках: [Куратор …: …], [Событие: …], [Клиент загрузил файл: …]. Это не слова клиента, а справка для тебя.",
    `Когда вопрос нужно передать куратору (см. «Когда передать куратору»): одной короткой фразой скажи клиенту, что передал вопрос и куратор ответит здесь, в чате, и последней строкой ответа поставь метку ${HANDOFF}. Клиент метку не видит, куратор получит вопрос сам. В WhatsApp не отправляй.`,
    "Отвечай коротко, обычным текстом без markdown-заголовков и таблиц.",
  ]
    .filter((x) => x !== undefined)
    .join("\n");
}

/** The stored chat as turns for the model: the client is «user», the assistant is «assistant», the rest are notes in brackets. */
function toTurns(history: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  const push = (role: "user" | "assistant", text: string) => {
    const t = text.trim().slice(0, CHAT_TEXT_MAX);
    if (!t) return;
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content += `\n\n${t}`;
    else turns.push({ role, content: t });
  };
  for (const m of history.filter((x) => x.kind !== "note").slice(-MAX_TURNS)) {
    if (m.from === "ai") push("assistant", m.text);
    else if (m.kind === "file") push("user", `[Клиент загрузил файл: ${m.doc ? FILE_SHORT[m.doc].ru : (m.file?.name ?? "файл")}]${m.text ? `\n${m.text}` : ""}`);
    else if (m.from === "client") push("user", m.text);
    else if (m.from === "staff") push("user", `[Куратор ${m.byName ?? "AlemWay"}: ${m.text}]`);
    else push("user", `[Событие: ${messageText(m, "ru")}]`);
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

export type AssistantResult = { text: string; handoff: boolean; failed: boolean };

/**
 * Asks the assistant to answer the last message of the chat. Text is passed to `onText` as it arrives,
 * with the handoff mark already cut out.
 */
export async function runAssistant(cab: Cabinet, history: ChatMessage[], onText: (chunk: string) => void): Promise<AssistantResult> {
  let pending = "";
  let text = "";
  let handoff = false;
  // Holds back the tail while it may still turn out to be the beginning of the mark.
  const emit = (final: boolean) => {
    for (let i = pending.indexOf(HANDOFF); i >= 0; i = pending.indexOf(HANDOFF)) {
      handoff = true;
      pending = pending.slice(0, i) + pending.slice(i + HANDOFF.length);
    }
    let keep = 0;
    if (!final) {
      for (let n = Math.min(HANDOFF.length - 1, pending.length); n > 0; n--) {
        if (HANDOFF.startsWith(pending.slice(-n))) {
          keep = n;
          break;
        }
      }
    }
    const out = pending.slice(0, pending.length - keep);
    pending = pending.slice(pending.length - keep);
    if (out) {
      text += out;
      onText(out);
    }
  };

  try {
    const messages = toTurns(history);
    if (!messages.length || messages[messages.length - 1].role !== "user") return { text: "", handoff: false, failed: true };
    const stream = new Anthropic().beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: ASSISTANT_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: clientContext(cab) },
      ],
      messages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        pending += event.delta.text;
        emit(false);
      }
    }
    const final = await stream.finalMessage();
    emit(true);
    await recordUsage("chat", final.usage);
    if (final.stop_reason === "refusal") {
      const say = `${text.trim() ? "\n\n" : ""}Этот вопрос лучше решит куратор. Я передал его, куратор ответит здесь, в чате.`;
      text += say;
      onText(say);
      handoff = true;
    }
    text = text.replace(/\[\[\s*curator\s*\]\]/gi, "").trim();
    return { text, handoff, failed: !text };
  } catch (err) {
    console.error("[chat] assistant failed", err);
    return { text: text.trim(), handoff, failed: true };
  }
}

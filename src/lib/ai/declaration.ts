import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "@/lib/cabinet/storage";
import type { Cabinet, StoredFile } from "@/lib/cabinet/server";
import { DECLARATION_PROMPT, UNIVERSITY_DIRECTORY } from "./prompts";
import { recordUsage } from "./usage";
import { FERIENJOB_FULL_SECTIONS } from "@/lib/cabinet/fields";

/**
 * «Декларационный отдел»: Claude reads the certificate, passport and calendar plus the short questionnaire
 * and returns the data for the official ZAV declaration form, or what is missing.
 */

export const DECLARATION_PDF_KEYS = [
  "txtfDritteName",
  "txtfDritteStr",
  "txtfDritteHausNr",
  "txtfDrittePlz",
  "txtfDritteOrt",
  "txtfDritteTel",
  "txtfDritteEmail",
  "txtfDritteWeb",
  "txtfPersonVorname",
  "txtfPersonNachname",
  "datePersonGebDatum",
  "txtfPersonNationalitaet",
  "txtfStudiumFach",
  "txtfStudiumDauer",
  "dateStudiumSeit",
  "dateStudiumEnde",
  "dateStudiumFerienVon",
  "dateStudiumFerienBis",
  "rbtnStudiumFortsetzung",
  "txtfUnterschriftOrt",
  "dateUnterschriftDatum",
] as const;
export type DeclarationFields = Record<(typeof DECLARATION_PDF_KEYS)[number], string>;

export const AI_STATUSES = ["ГОТОВО", "ГОТОВО БЕЗ ПАСПОРТА", "НЕ ГОТОВО"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export type AiCheck = {
  status: AiStatus;
  fields: DeclarationFields;
  checks: string[];
  missing: string[];
  clientMessage: string;
  checkedAt: string;
};

const MODEL = "claude-opus-5-5";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "fields", "checks", "missing", "clientMessage"],
  properties: {
    status: { type: "string", enum: [...AI_STATUSES] },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [...DECLARATION_PDF_KEYS],
      properties: Object.fromEntries(DECLARATION_PDF_KEYS.map((k) => [k, { type: "string" }])),
    },
    checks: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" } },
    clientMessage: { type: "string" },
  },
} as const;

// Our answer format replaces the text format from the prompt: same content, as JSON for the site.
const OUTPUT_RULES = `## Формат ответа для сайта
Вместо текстового формата верни JSON по схеме:
- status — «ГОТОВО», «ГОТОВО БЕЗ ПАСПОРТА» или «НЕ ГОТОВО».
- fields — данные для бланка по ключам полей. При «НЕ ГОТОВО» все поля пустые строки. Даты ДД.ММ.ГГГГ. rbtnStudiumFortsetzung — «Yes» или «No».
- checks — «ПРОВЕРИТЬ / ОШИБКИ» (для менеджера).
- missing — «ЧЕГО НЕ ХВАТАЕТ» (видит клиент, пиши понятно, по одному пункту).
- clientMessage — «СООБЩЕНИЕ КЛИЕНТУ» (пусто, если всё есть).`;

// On the site the study fields are optional and marked «заполните, если этого нет в справке»:
// the questionnaire is the agreed fallback for them, so it must not block the declaration.
const SITE_RULES = `## Правило сайта: учёба из анкеты (важнее правил выше)
В анкете на сайте поля «Специальность», «Курс», «Срок обучения», «Дата зачисления», «Ожидаемая дата выпуска», «Каникулы с/по» клиент заполняет, только если этого нет в справке.
- Если в справке это есть — бери из справки (как и раньше); анкета расходится — верь справке и отметь в «ПРОВЕРИТЬ».
- Если в справке этого нет, а в анкете есть — бери из анкеты и выдавай декларацию. Не пиши это в «ЧЕГО НЕ ХВАТАЕТ» и не проси новую справку. В «ПРОВЕРИТЬ» добавь: «<поле> взято из анкеты — в справке нет, сверить с вузом».
- Специальность в анкете на русском/казахском — переведи на английский.
- В «ЧЕГО НЕ ХВАТАЕТ» пиши поле, только если его нет ни в справке, ни в анкете.
Справка при этом всё равно обязательна: без неё, не на английском или если она не на студента — «НЕ ГОТОВО».

## Справка — только на английском (строго)
Принимаем только справку на английском языке. Двуязычная справка подходит, если на ней есть полный английский текст (имя, вуз, специальность, даты). Справка только на русском/казахском — «НЕ ГОТОВО», даже если ты можешь её перевести: сами не переводим. В «ЧЕГО НЕ ХВАТАЕТ»: «Справка с места учёбы на английском языке — загруженная справка на русском/казахском, возьмите в вузе справку на английском».

## Летние каникулы длиннее 90 дней — НЕ блок (важнее правил выше)
Если каникулы летом 2027, но длиннее 90 дней (например 01.06.2027–31.08.2027 = 92 дня), не ставь «НЕ ГОТОВО» и не проси уточнить даты. Оставь начало, а конец поставь так, чтобы было ровно 90 дней включительно (01.06.2027 → 29.08.2027). В «ПРОВЕРИТЬ»: «Каникулы укорочены до 90 дней: ДД.ММ.ГГГГ–ДД.ММ.ГГГГ».

## Печать на справке НЕ обязательна (важнее правил выше)
Некоторые вузы не ставят печать: справка с QR-кодом / электронной подписью или вообще без печати — это нормально. Главное, чтобы справка была на английском и выдана вузом на этого студента. Никогда не ставь «НЕ ГОТОВО» и не проси новую справку из-за отсутствия печати; только отметь в «ПРОВЕРИТЬ»: «На справке нет печати (электронная подпись/QR) — принято».

## Исправления команды (важнее всего)
Поле с пометкой [ИСПРАВЛЕНО КОМАНДОЙ] менеджер сверил и исправил вручную. Оно важнее справки, паспорта и календаря: бери значение как есть (только приведи формат), не считай расхождение ошибкой и не проси из-за него новые документы. В «ПРОВЕРИТЬ» коротко отметь: «<поле> — по исправлению команды».`;

const SYSTEM = `${DECLARATION_PROMPT}\n\n${UNIVERSITY_DIRECTORY}\n\n${SITE_RULES}\n\n${OUTPUT_RULES}`;

const LABELS: Record<string, string> = {
  passport: "Загранпаспорт",
  enrollment: "Справка с места учёбы",
  calendar: "Академический календарь вуза",
};

async function toBuffer(body: ReadableStream | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fileBlocks(kind: string, file: StoredFile | undefined): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  if (!file?.path) return [];
  const found = await readFile(file.path);
  if (!found) return [];
  const data = (await toBuffer(found.body as ReadableStream | Buffer)).toString("base64");
  const label = { type: "text" as const, text: `Файл: ${LABELS[kind] ?? kind}` };
  if (found.contentType === "application/pdf") {
    return [label, { type: "document", source: { type: "base64", media_type: "application/pdf", data }, title: LABELS[kind] }];
  }
  const media = found.contentType === "image/png" ? "image/png" : "image/jpeg";
  return [label, { type: "image", source: { type: "base64", media_type: media, data } }];
}

const QUESTION_LABELS: Record<string, string> = {
  phone: "Телефон",
  city: "Город проживания",
  driverLicense: "Категория прав",
  uniName: "Название вуза (если нет в справке)",
  subject: "Специальность (если нет в справке)",
  studyYears: "Срок обучения, лет (если нет в справке)",
  enrolledSince: "Дата зачисления (если нет в справке)",
  studyEnd: "Ожидаемая дата выпуска (если нет в справке)",
  breakFrom: "Каникулы с (если нет в справке)",
  breakTo: "Каникулы по (если нет в справке)",
  continueStudies: "Продолжает учёбу после каникул",
  firstName: "Имя латиницей",
  lastName: "Фамилия латиницей",
  birthDate: "Дата рождения",
  nationality: "Гражданство",
};

/** Runs the check. Throws if the AI is not configured or the request fails. */
export async function runDeclarationCheck(cab: Cabinet, todayIso: string): Promise<AiCheck> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();

  const docs = (await Promise.all((["passport", "enrollment", "calendar"] as const).map((k) => fileBlocks(k, cab.files?.[k])))).flat();
  const edited = new Set(cab.teamEdited ?? []);
  const fieldLabel = Object.fromEntries(FERIENJOB_FULL_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f.label.ru]));
  // Everything the team corrected is passed too, even fields the client never sees.
  const keys = [...Object.keys(QUESTION_LABELS), ...[...edited].filter((k) => !(k in QUESTION_LABELS))];
  const answers = keys
    .map((k) => {
      const v = cab.data?.[k];
      const label = QUESTION_LABELS[k] ?? fieldLabel[k] ?? k;
      const mark = edited.has(k) && v ? " [ИСПРАВЛЕНО КОМАНДОЙ]" : "";
      return `- ${label}: ${v ? (k === "continueStudies" ? (v === "no" ? "Нет" : "Да") : v) : "—"}${mark}`;
    })
    .join("\n");
  const today = todayIso.split("-").reverse().join(".");
  const has = (k: string) => (cab.files?.[k as keyof typeof cab.files]?.path ? "загружен" : "НЕ загружен");

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...docs,
          {
            type: "text",
            text: `Сегодня: ${today}.\nПаспорт: ${has("passport")}. Справка: ${has("enrollment")}. Календарь вуза: ${has("calendar")}.\n\nАнкета клиента:\n${answers}`,
          },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  await recordUsage("declaration", msg.usage);
  if (msg.stop_reason === "refusal") throw new Error("AI refused the request");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = JSON.parse(text) as Omit<AiCheck, "checkedAt">;
  if (!AI_STATUSES.includes(parsed.status)) throw new Error(`Unexpected AI status: ${parsed.status}`);
  return { ...parsed, checkedAt: new Date().toISOString() };
}

export const aiReady = (s: AiStatus | undefined) => s === "ГОТОВО" || s === "ГОТОВО БЕЗ ПАСПОРТА";

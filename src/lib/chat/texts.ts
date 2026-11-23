/** Texts of chat events and short document names (shared by client and server code). */
import { CABINET_STATUSES, FILE_LABELS, PIPELINES, type FileKind } from "@/lib/cabinet/fields";
import type { ChatEvent, ChatMessage } from "./types";

export type ChatLocale = "ru" | "kk";

/** Short document names for buttons and tiles (the full names live in FILE_LABELS). */
export const FILE_SHORT: Record<FileKind, { ru: string; kk: string }> = {
  passport: { ru: "Паспорт", kk: "Паспорт" },
  enrollment: { ru: "Справка с учёбы", kk: "Оқу орнынан анықтама" },
  calendar: { ru: "Календарь вуза", kk: "ЖОО күнтізбесі" },
  license: { ru: "Водительские права", kk: "Жүргізуші куәлігі" },
  declaration: { ru: "Декларация", kk: "Декларация" },
  declaration2: { ru: "Декларация, 2-й вариант", kk: "Декларация, 2-нұсқа" },
  signed: { ru: "Декларация с печатью, 1-й экз.", kk: "Мөрі бар декларация, 1-дана" },
  signed2: { ru: "Декларация с печатью, 2-й экз.", kk: "Мөрі бар декларация, 2-дана" },
  zav: { ru: "ZAV", kk: "ZAV" },
  photo: { ru: "Фото", kk: "Фото" },
  keta: { ru: "K-ETA", kk: "K-ETA" },
  contract: { ru: "Договор", kk: "Келісімшарт" },
};

const niceDate = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : (iso ?? ""));

/** The client-facing name of a stage, e.g. «Подпись и печать декана». */
export function stageTitle(status: string | undefined, locale: ChatLocale = "ru") {
  for (const steps of Object.values(PIPELINES)) {
    const step = steps.find((s) => s.status === status);
    if (step) return step.title[locale];
  }
  return CABINET_STATUSES.find((s) => s.value === status)?.title ?? status ?? "";
}

const EVENT_TEXT: Record<ChatEvent, { ru: (arg: string) => string; kk: (arg: string) => string; team?: (arg: string, who: string) => string }> = {
  declaration_ready: {
    ru: () => "Декларация готова. Скачайте её, распечатайте в 2 экземплярах и отнесите в деканат: на каждом нужны подпись и печать.",
    kk: () => "Декларация дайын. Оны жүктеп алып, 2 дана етіп басып шығарыңыз да, деканатқа апарыңыз: әрқайсысына қол мен мөр керек.",
  },
  declaration_updated: {
    ru: () => "Декларацию обновили. Скачайте новую версию и несите в деканат именно её: старую распечатку не используйте.",
    kk: () => "Декларация жаңартылды. Жаңа нұсқасын жүктеп алып, деканатқа соны апарыңыз: ескі басылған нұсқаны қолданбаңыз.",
  },
  stage: { ru: (a) => `Новый этап: ${a}.`, kk: (a) => `Жаңа кезең: ${a}.` },
  deadline: {
    ru: (a) => `Срок сдачи документов и декларации: до ${a} включительно.`,
    kk: (a) => `Құжаттар мен декларацияны тапсыру мерзімі: ${a} дейін (қоса алғанда).`,
  },
  deadline_soon: {
    ru: (a) => {
      const [date, days] = a.split("|");
      return days === "0"
        ? `Сегодня последний день: документы и декларацию с печатью нужно сдать до 23:59 (${niceDate(date)}). Если что-то мешает, напишите сюда.`
        : `Напоминаем: до срока сдачи документов и декларации с печатью осталось ${days} дн. (до ${niceDate(date)}). Если что-то мешает, напишите сюда.`;
    },
    kk: (a) => {
      const [date, days] = a.split("|");
      return days === "0"
        ? `Бүгін соңғы күн: құжаттар мен мөрі бар декларацияны 23:59-ға дейін тапсыру керек (${niceDate(date)}). Бірдеңе кедергі болса, осында жазыңыз.`
        : `Еске саламыз: құжаттар мен мөрі бар декларацияны тапсыру мерзіміне ${days} күн қалды (${niceDate(date)} дейін). Бірдеңе кедергі болса, осында жазыңыз.`;
    },
  },
  deadline_removed: { ru: () => "Срок сдачи документов снят.", kk: () => "Құжаттарды тапсыру мерзімі алынып тасталды." },
  zav: {
    ru: () => "Разрешение ZAV получено, контракт есть! Скачайте ZAV: он нужен для визы. Данные о работе смотрите в кабинете.",
    kk: () => "ZAV рұқсаты алынды, келісімшарт бар! ZAV-ты жүктеп алыңыз: ол визаға керек. Жұмыс туралы мәліметті кабинеттен қараңыз.",
  },
  keta: { ru: () => "K-ETA одобрен. Разрешение можно скачать здесь или в кабинете.", kk: () => "K-ETA мақұлданды. Рұқсатты осы жерден немесе кабинеттен жүктеп алуға болады." },
  called: {
    ru: () => "Вы позвали куратора. Он ответит здесь, в чате.",
    kk: () => "Сіз кураторды шақырдыңыз. Ол осы чатта жауап береді.",
    team: () => "Клиент позвал куратора.",
  },
  file_received: {
    ru: () => "Файл получили. Куратор посмотрит и ответит здесь.",
    kk: () => "Файлды алдық. Куратор қарап, осы жерде жауап береді.",
    team: () => "Клиент прислал файл. Посмотрите и ответьте.",
  },
  signed_both: {
    ru: () => "Оба экземпляра загружены. Осталось нажать «Отправить декларацию с печатью» в кабинете: тогда мы их получим.",
    kk: () => "Екі дана да жүктелді. Енді кабинетте «Мөрі бар декларацияны жіберу» батырмасын басыңыз: сонда біз оларды аламыз.",
    team: () => "Клиент загрузил оба экземпляра с печатью. Ему осталось нажать «Отправить» в кабинете.",
  },
  ai_down: {
    ru: () => "Помощник сейчас недоступен. Вопрос передали куратору, он ответит здесь.",
    kk: () => "Көмекші қазір қолжетімсіз. Сұрағыңыз кураторға жіберілді, ол осы жерде жауап береді.",
    team: () => "Помощник (ИИ) не смог ответить. Вопрос ждёт вас.",
  },
  resolved: {
    ru: () => "Куратор завершил разговор. Если появится новый вопрос, просто напишите сюда.",
    kk: () => "Куратор әңгімені аяқтады. Жаңа сұрақ туындаса, осы жерге жаза беріңіз.",
    team: (_a, who) => `${who || "Сотрудник"}: решено. На новые вопросы сначала ответит помощник (ИИ).`,
  },
};

/** Text of a message for the reader: events are translated, the rest is shown as written. */
export function messageText(m: Pick<ChatMessage, "text" | "event" | "arg" | "byName">, locale: ChatLocale = "ru", viewer: "client" | "team" = "client"): string {
  const def = m.event ? EVENT_TEXT[m.event] : undefined;
  if (!def) return m.text;
  const arg = m.event === "stage" ? stageTitle(m.arg, locale) : m.event === "deadline" ? niceDate(m.arg) : (m.arg ?? "");
  if (viewer === "team" && def.team) return def.team(arg, m.byName ?? "");
  return def[locale](arg);
}

/** «Скан загранпаспорта (разворот с фото)» → the name used when the team asks for a document. */
export const fileAskName = (kind: FileKind, locale: ChatLocale = "ru") => FILE_LABELS[kind][locale].replace(/\s*\((необязательно|міндетті емес)\)\s*$/i, "");

/** One line for chat lists: the last message, cut short. */
export function previewOf(m: Pick<ChatMessage, "text" | "event" | "arg" | "byName" | "kind" | "doc" | "file">): string {
  const text = m.kind === "file" ? `📎 ${m.doc ? FILE_SHORT[m.doc].ru : (m.file?.name ?? "Файл")}${m.text ? `: ${m.text}` : ""}` : messageText(m, "ru", "team");
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 140 ? `${one.slice(0, 139)}…` : one;
}

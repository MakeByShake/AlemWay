"use client";

import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { Bot, Check, CheckCheck, Download, FileText, Loader2, StickyNote, Upload } from "lucide-react";
import type { FileKind } from "@/lib/cabinet/fields";
import { FILE_SHORT, messageText, type ChatLocale } from "@/lib/chat/texts";
import type { ChatMessageView } from "@/lib/chat/types";

/** Shared look of a chat for both sides: the client's page and the team's «Чаты». */

const UI = {
  ru: {
    today: "Сегодня",
    yesterday: "Вчера",
    assistant: "Помощник (ИИ)",
    curator: "куратор",
    note: "Заметка для команды · клиент не видит",
    saved: "Сохранено в документах",
    download: "Скачать",
    open: "Открыть",
    upload: "Загрузить",
    uploaded: "Загружено",
    uploading: "Загружаем…",
    waitingFile: "Ждём файл от клиента",
    cabinet: "Открыть кабинет",
    read: "Прочитано",
    sent: "Отправлено",
    all: "всем",
    failed: "Не отправлено. Нажмите, чтобы повторить",
  },
  kk: {
    today: "Бүгін",
    yesterday: "Кеше",
    assistant: "Көмекші (ЖИ)",
    curator: "куратор",
    note: "Команда үшін жазба · клиент көрмейді",
    saved: "Құжаттарға сақталды",
    download: "Жүктеп алу",
    open: "Ашу",
    upload: "Жүктеу",
    uploaded: "Жүктелді",
    uploading: "Жүктеп жатырмыз…",
    waitingFile: "Клиенттен файл күтеміз",
    cabinet: "Кабинетті ашу",
    read: "Оқылды",
    sent: "Жіберілді",
    all: "барлығына",
    failed: "Жіберілмеді. Қайталау үшін басыңыз",
  },
};

export type LocalMessage = ChatMessageView & { local?: "sending" | "typing" | "failed" };

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function dayLabel(iso: string, locale: ChatLocale) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days === 0) return UI[locale].today;
  if (days === 1) return UI[locale].yesterday;
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }).format(d);
}
const timeOf = (iso: string) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const sizeOf = (n: number) => (n > 900_000 ? `${(n / 1_048_576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

/** Plain text with links made clickable. */
function Linked({ text, own }: { text: string; own: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className={clsx("break-all underline", own ? "text-white" : "text-brand")}>
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

export type MessagesProps = {
  messages: LocalMessage[];
  /** Who looks at the chat. The team sees notes, read marks and the assistant's answers on its own side. */
  viewer: "client" | "team";
  locale?: ChatLocale;
  /** Where this reader opens a client's document. */
  docUrl: (kind: FileKind) => string;
  /** Documents that are in the cabinet now. */
  have: readonly string[];
  /** Client only: documents that can be uploaded now, and what happens when «Загрузить» is pressed. */
  uploads?: readonly string[];
  onUpload?: (kind: FileKind) => void;
  uploadingKind?: string | null;
  cabinetHref?: string;
  /** Team only: when the client last opened the chat. */
  clientReadAt?: string | null;
  onRetry?: (m: LocalMessage) => void;
  /** Shown before the first message. */
  intro?: ReactNode;
};

type Ctx = Required<Pick<MessagesProps, "viewer" | "docUrl" | "have">> &
  Pick<MessagesProps, "onUpload" | "uploadingKind" | "cabinetHref" | "clientReadAt" | "onRetry"> & { locale: ChatLocale; uploads: readonly string[]; team: boolean; t: (typeof UI)["ru"] };

export function Messages({ messages, viewer, locale = "ru", docUrl, have, uploads = [], onUpload, uploadingKind, cabinetHref, clientReadAt, onRetry, intro }: MessagesProps) {
  const c: Ctx = { viewer, locale, docUrl, have, uploads, onUpload, uploadingKind, cabinetHref, clientReadAt, onRetry, team: viewer === "team", t: UI[locale] };
  return (
    <div className="space-y-2.5">
      {intro}
      {messages.map((m, i) => (
        <Fragment key={m._key}>
          {(i === 0 || dayKey(m.at) !== dayKey(messages[i - 1].at)) && (
            <div className="flex justify-center py-1">
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-muted shadow-[0_1px_2px_rgba(11,15,36,0.08)]">{dayLabel(m.at, locale)}</span>
            </div>
          )}
          <Row m={m} c={c} />
        </Fragment>
      ))}
    </div>
  );
}

function Row({ m, c }: { m: LocalMessage; c: Ctx }) {
  const { t, team, locale, viewer, clientReadAt, onRetry } = c;
  if (m.kind === "event" && !m.action) {
    return (
      <div className="flex justify-center px-6">
        <span className="rounded-xl bg-brand-soft px-3 py-1.5 text-center text-[13px] leading-snug text-ink/80">{messageText(m, locale, viewer)}</span>
      </div>
    );
  }
  // Own side: the client's messages for the client; everything AlemWay sent for the team.
  const own = team ? m.from !== "client" : m.from === "client";
  const note = m.kind === "note";
  const system = m.from === "system";
  const tone = note
    ? "bg-[#fff3c4] text-ink"
    : own && (team ? m.from === "staff" : true)
      ? "bg-brand text-white"
      : own
        ? "bg-brand-soft text-ink"
        : system
          ? "border border-brand/25 bg-white text-ink"
          : "border border-line bg-white text-ink";
  const dark = tone.startsWith("bg-brand ");
  const label = note
    ? `${m.byName ?? ""}`
    : m.from === "ai"
      ? t.assistant
      : m.from === "staff"
        ? team
          ? `${m.byName ?? "AlemWay"}${m.bulk ? ` · ${t.all}` : ""}`
          : `${m.byName ?? "AlemWay"} · ${t.curator}`
        : system
          ? "AlemWay"
          : "";
  const text = messageText(m, locale, viewer);
  const read = team && m.from === "staff" && !note && Boolean(clientReadAt && clientReadAt >= m.at);
  return (
    <div className={clsx("flex", own ? "justify-end" : "justify-start")}>
      <div className={clsx("max-w-[86%] sm:max-w-[75%]", m.local === "failed" && "opacity-80")}>
        {label && (own ? team : true) && (
          <p className={clsx("mb-0.5 flex items-center gap-1 px-1 text-[12px] font-semibold text-muted", own && "justify-end")}>
            {m.from === "ai" && <Bot className="h-3.5 w-3.5" />}
            {note && <StickyNote className="h-3.5 w-3.5" />}
            {label}
          </p>
        )}
        <div className={clsx("rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed", tone, own ? "rounded-br-md" : "rounded-bl-md")}>
          {m.kind === "file" && <FileBit m={m} dark={dark} c={c} />}
          {m.local === "typing" && !text ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : text && <p className="whitespace-pre-line break-words"><Linked text={text} own={dark} /></p>}
          {m.action && <Action m={m} c={c} />}
          <p className={clsx("mt-0.5 flex items-center justify-end gap-1 text-[11px] leading-none", dark ? "text-white/75" : "text-muted")}>
            {note && <span>{t.note}</span>}
            {m.local === "sending" ? <Loader2 className="h-3 w-3 animate-spin" /> : !m.local && <span>{timeOf(m.at)}</span>}
            {team && m.from === "staff" && !note && (read ? <CheckCheck className="h-3.5 w-3.5" aria-label={t.read} /> : <Check className="h-3.5 w-3.5 opacity-70" aria-label={t.sent} />)}
          </p>
        </div>
        {m.local === "failed" && (
          <button type="button" onClick={() => onRetry?.(m)} className="mt-1 block w-full text-right text-[12.5px] font-semibold text-red-600 hover:underline">
            {t.failed}
          </button>
        )}
      </div>
    </div>
  );
}

function FileBit({ m, dark, c }: { m: LocalMessage; dark: boolean; c: Ctx }) {
  const { t, team, locale, have, docUrl } = c;
  const chip = clsx("flex items-center gap-2.5 rounded-xl px-2.5 py-2", dark ? "bg-white/15" : "bg-surface");
  if (m.doc) {
    const exists = have.includes(m.doc);
    const inner = (
      <>
        <FileText className="h-7 w-7 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{FILE_SHORT[m.doc][locale]}</span>
          <span className={clsx("block text-[12px]", dark ? "text-white/80" : "text-muted")}>{t.saved}</span>
        </span>
      </>
    );
    return exists ? (
      <a href={docUrl(m.doc)} {...(team ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })} className={clsx(chip, "mb-1")}>
        {inner}
      </a>
    ) : (
      <div className={clsx(chip, "mb-1")}>{inner}</div>
    );
  }
  if (!m.file) return null;
  const href = team ? `${m.file.url}&view=1` : m.file.url;
  const link = team ? { target: "_blank", rel: "noopener noreferrer" } : { download: true };
  if (m.file.contentType.startsWith("image/")) {
    return (
      <a href={href} {...link} className="mb-1 block overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by our API, not a static asset */}
        <img src={`${m.file.url}&view=1`} alt={m.file.name} loading="lazy" className="max-h-64 w-full min-w-40 object-cover" />
      </a>
    );
  }
  return (
    <a href={href} {...link} className={clsx(chip, "mb-1")}>
      <FileText className="h-7 w-7 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold">{m.file.name}</span>
        <span className={clsx("block text-[12px]", dark ? "text-white/80" : "text-muted")}>{sizeOf(m.file.size)}</span>
      </span>
    </a>
  );
}

function Action({ m, c }: { m: LocalMessage; c: Ctx }) {
  const { t, team, have, docUrl, uploads, uploadingKind, onUpload, cabinetHref } = c;
  const btn = "mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-[14.5px] font-semibold";
  if (m.action === "cabinet") {
    return team ? null : (
      <a href={cabinetHref ?? "/ru/cabinet"} className={clsx(btn, "bg-brand text-white hover:bg-brand-dark")}>
        {t.cabinet}
      </a>
    );
  }
  if (!m.doc) return null;
  const exists = have.includes(m.doc);
  if (m.action === "download") {
    if (!exists) return null;
    return (
      <a href={docUrl(m.doc)} {...(team ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })} className={clsx(btn, "bg-brand text-white hover:bg-brand-dark")}>
        <Download className="h-4 w-4" /> {team ? t.open : t.download}
      </a>
    );
  }
  // «Попросить у клиента»: the client uploads the document right from the chat.
  if (exists) {
    return (
      <p className={clsx(btn, "bg-accent-soft text-[#0a7a42]")}>
        <Check className="h-4 w-4" /> {t.uploaded}
      </p>
    );
  }
  if (team) return <p className="mt-1.5 text-[12.5px] font-medium opacity-80">{t.waitingFile}</p>;
  if (!uploads.includes(m.doc)) return null;
  const busy = uploadingKind === m.doc;
  return (
    <button type="button" disabled={Boolean(uploadingKind)} onClick={() => onUpload?.(m.doc!)} className={clsx(btn, "bg-brand text-white hover:bg-brand-dark disabled:opacity-60")}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? t.uploading : t.upload}
    </button>
  );
}

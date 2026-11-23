"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Bot, FileText, Headset, Loader2, X } from "lucide-react";
import { MAX_UPLOAD_BYTES, type FileKind } from "@/lib/cabinet/fields";
import { compressForUpload } from "@/lib/compress-file";
import { FILE_SHORT } from "@/lib/chat/texts";
import { CHAT_TEXT_MAX, newMessageKey, type ChatMessageView, type ChatMode } from "@/lib/chat/types";
import { Composer } from "@/components/chat/Composer";
import { useCoverScreen } from "@/components/chat/cover";
import { useChatFeed } from "@/components/chat/live";
import { Messages, type LocalMessage } from "@/components/chat/Messages";

const TEXT = {
  ru: {
    title: "AlemWay",
    back: "Назад в кабинет",
    statusAi: "Помощник (ИИ)",
    statusWaiting: "Ждём куратора",
    statusHuman: "Куратор на связи",
    statusTeam: "Кураторы AlemWay",
    call: "Позвать куратора",
    callShort: "Куратор",
    helloAi:
      "Здравствуйте! Это чат с AlemWay. На вопросы по документам сразу отвечает помощник (ИИ). Нужен человек? Нажмите «Позвать куратора». Сюда же приходят новости по вашему делу.",
    helloTeam: "Здравствуйте! Это чат с кураторами AlemWay. Напишите вопрос, ответим здесь. Сюда же приходят новости по вашему делу.",
    placeholder: "Сообщение…",
    send: "Отправить",
    attach: "Прикрепить файл",
    noteAi: "Отвечает ИИ. Оплату, визу и работодателя уточняйте у куратора.",
    noteWaiting: "Сообщение у куратора. Ответ придёт сюда, в чат.",
    chips: ["Что мне ещё загрузить?", "Где взять справку на английском?", "У меня ещё нет паспорта"],
    sheetTitle: "Что это за файл?",
    sheetHint: "Документ сразу сохранится в вашем кабинете.",
    other: "Другое",
    otherHint: "Покажем куратору",
    cancel: "Отмена",
    tooMany: "Слишком много сообщений. Подождите немного.",
    errGeneric: "Не получилось. Попробуйте ещё раз.",
    errTooLarge: "Файл больше 4 МБ. Сожмите его или сфотографируйте заново.",
    errType: "Подойдёт только PDF, JPG или PNG.",
    errLocked: "Сейчас этот документ заменить нельзя. Напишите об этом куратору.",
    errNoDeclaration: "Сначала должна быть готова декларация.",
    loadFailed: "Не получилось открыть чат. Проверьте интернет.",
    retry: "Повторить",
  },
  kk: {
    title: "AlemWay",
    back: "Кабинетке оралу",
    statusAi: "Көмекші (ЖИ)",
    statusWaiting: "Кураторды күтеміз",
    statusHuman: "Куратор байланыста",
    statusTeam: "AlemWay кураторлары",
    call: "Кураторды шақыру",
    callShort: "Куратор",
    helloAi:
      "Сәлеметсіз бе! Бұл AlemWay-мен чат. Құжаттар туралы сұрақтарға көмекші (ЖИ) бірден жауап береді. Адам керек пе? «Кураторды шақыру» батырмасын басыңыз. Ісіңіз бойынша жаңалықтар да осында келеді.",
    helloTeam: "Сәлеметсіз бе! Бұл AlemWay кураторларымен чат. Сұрағыңызды жазыңыз, осы жерде жауап береміз. Ісіңіз бойынша жаңалықтар да осында келеді.",
    placeholder: "Хабарлама…",
    send: "Жіберу",
    attach: "Файл тіркеу",
    noteAi: "ЖИ жауап береді. Төлем, виза және жұмыс беруші туралы куратордан сұраңыз.",
    noteWaiting: "Хабарлама кураторда. Жауап осы чатқа келеді.",
    chips: ["Тағы не жүктеуім керек?", "Ағылшынша анықтаманы қайдан аламын?", "Менде әлі паспорт жоқ"],
    sheetTitle: "Бұл қандай файл?",
    sheetHint: "Құжат бірден кабинетіңізге сақталады.",
    other: "Басқа",
    otherHint: "Кураторға көрсетеміз",
    cancel: "Болдырмау",
    tooMany: "Хабарлама тым көп. Біраз күтіңіз.",
    errGeneric: "Болмады. Қайталап көріңіз.",
    errTooLarge: "Файл 4 МБ-тан үлкен. Оны сығыңыз немесе қайта суретке түсіріңіз.",
    errType: "Тек PDF, JPG немесе PNG жарайды.",
    errLocked: "Бұл құжатты қазір ауыстыруға болмайды. Бұл туралы кураторға жазыңыз.",
    errNoDeclaration: "Алдымен декларация дайын болуы керек.",
    loadFailed: "Чат ашылмады. Интернетті тексеріңіз.",
    retry: "Қайталау",
  },
};

type Meta = {
  ok: boolean;
  mode: ChatMode;
  waiting: boolean;
  unread: number;
  assistant: boolean;
  messages: ChatMessageView[];
  uploads: string[];
  have: string[];
  live: string | null;
};

/** The client's chat with AlemWay: the assistant, the curators and news about the case in one thread. Fills the screen. */
export function CabinetChat({ locale }: { locale: "ru" | "kk" }) {
  const t = TEXT[locale];
  const { messages, meta, failed, loading, refresh } = useChatFeed<Meta>("/api/cabinet/chat");
  const [locals, setLocals] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const asked = useRef<HTMLInputElement>(null);
  const askedKind = useRef<FileKind | null>(null);

  const known = new Set(messages.map((m) => m._key));
  const list: LocalMessage[] = [...messages, ...locals.filter((l) => !known.has(l._key))];
  const tail = list.length ? `${list.length}:${list[list.length - 1].text.length}` : "";

  // The chat covers the page: lock the page behind it and follow the on-screen keyboard.
  const shell = useCoverScreen<HTMLDivElement>(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  });

  // New messages keep the view at the bottom unless the reader scrolled up to look at older ones.
  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [tail]);

  // Opening the chat marks the new messages as read.
  const unread = meta?.unread ?? 0;
  useEffect(() => {
    if (!unread) return;
    const mark = () => {
      if (!document.hidden) void fetch("/api/cabinet/chat/read", { method: "POST" }).catch(() => null);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [unread]);

  async function send(text: string, retryKey?: string) {
    const q = text.trim();
    if (!q || busy) return;
    const key = retryKey ?? newMessageKey();
    setError(null);
    setInput("");
    setBusy(true);
    stick.current = true;
    setLocals((l) => [...l.filter((x) => x._key !== key), { _key: key, at: new Date().toISOString(), from: "client", kind: "text", text: q, local: "sending" }]);
    const patch = (k: string, change: Partial<LocalMessage>) => setLocals((l) => l.map((x) => (x._key === k ? { ...x, ...change } : x)));
    try {
      const res = await fetch("/api/cabinet/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q, key }) });
      if (!res.ok) throw new Error(res.status === 429 ? t.tooMany : t.errGeneric);
      patch(key, { local: undefined });
      if (res.headers.get("X-Chat-Reply") === "assistant" && res.body) {
        // The assistant answers: show its text as it arrives.
        const replyKey = `${key}a`;
        setLocals((l) => [...l, { _key: replyKey, at: new Date().toISOString(), from: "ai", kind: "text", text: "", local: "typing" }]);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let answer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          answer += dec.decode(value, { stream: true });
          patch(replyKey, { text: answer });
        }
        // An empty answer means the question went to a curator: the server has put a line about it into the chat.
        setLocals((l) => (answer.trim() ? l.map((x) => (x._key === replyKey ? { ...x, local: undefined } : x)) : l.filter((x) => x._key !== replyKey)));
      }
    } catch (err) {
      patch(key, { local: "failed" });
      setLocals((l) => l.filter((x) => x._key !== `${key}a`));
      setError(err instanceof Error && err.message ? err.message : t.errGeneric);
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function upload(file: File, kind: string) {
    setPicked(null);
    setError(null);
    setUploading(kind);
    stick.current = true;
    try {
      const ready = await compressForUpload(file);
      if (ready.size > MAX_UPLOAD_BYTES) throw new Error(t.errTooLarge);
      const fd = new FormData();
      fd.append("file", ready);
      const res = await fetch(`/api/cabinet/chat/file?kind=${encodeURIComponent(kind)}`, { method: "POST", body: fd });
      if (!res.ok) {
        const code = ((await res.json().catch(() => ({}))) as { error?: string }).error;
        const known: Record<string, string> = { too_large: t.errTooLarge, bad_type: t.errType, locked: t.errLocked, no_declaration: t.errNoDeclaration, too_many: t.tooMany };
        throw new Error(known[code ?? ""] ?? t.errGeneric);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.errGeneric);
    } finally {
      setUploading(null);
      void refresh();
    }
  }

  async function call() {
    setCalling(true);
    setError(null);
    stick.current = true;
    try {
      const res = await fetch("/api/cabinet/chat/call", { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      setError(t.errGeneric);
    } finally {
      setCalling(false);
      void refresh();
    }
  }

  const mode = meta?.mode ?? "ai";
  const assistant = meta?.assistant ?? true;
  const answersAi = assistant && mode === "ai";
  const status = meta?.waiting ? t.statusWaiting : mode === "human" ? t.statusHuman : assistant ? t.statusAi : t.statusTeam;
  const spoke = list.some((m) => m.from === "client");

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line bg-white px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
        <Link prefetch={false} href={`/${locale}/cabinet`} aria-label={t.back} title={t.back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-[17px] font-bold text-white" aria-hidden>
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] leading-tight font-bold">{t.title}</p>
          <p className="flex items-center gap-1 truncate text-[13px] text-muted">
            {answersAi && <Bot className="h-3.5 w-3.5 shrink-0" />}
            {meta?.waiting && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}
            {!meta?.waiting && mode === "human" && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
            <span className="truncate">{status}</span>
          </p>
        </div>
        {answersAi && (
          <button
            type="button"
            onClick={call}
            disabled={calling || !meta}
            aria-label={t.call}
            title={t.call}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[14px] font-semibold hover:border-brand disabled:opacity-60"
          >
            {calling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headset className="h-4 w-4 text-brand" />}
            <span className="sm:hidden">{t.callShort}</span>
            <span className="hidden sm:inline">{t.call}</span>
          </button>
        )}
      </header>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        aria-live="polite"
      >
        <div className="mx-auto max-w-3xl">
          {loading && (
            <p className="flex justify-center py-10 text-muted">
              <Loader2 className="h-6 w-6 animate-spin" />
            </p>
          )}
          {failed && !meta && (
            <div className="py-10 text-center text-[15px] text-muted">
              <p>{t.loadFailed}</p>
              <button type="button" onClick={() => void refresh()} className="btn-ghost mt-3 min-h-10 px-4 text-[14px]">
                {t.retry}
              </button>
            </div>
          )}
          {meta && (
            <Messages
              messages={list}
              viewer="client"
              locale={locale}
              docUrl={(kind) => `/api/cabinet/file/${kind}`}
              have={meta.have}
              uploads={meta.uploads}
              uploadingKind={uploading}
              onUpload={(kind) => {
                askedKind.current = kind;
                asked.current?.click();
              }}
              cabinetHref={`/${locale}/cabinet`}
              onRetry={(m) => void send(m.text, m._key)}
              intro={
                <div className="flex justify-start">
                  <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[75%]">{assistant ? t.helloAi : t.helloTeam}</div>
                </div>
              }
            />
          )}
          {meta && assistant && !spoke && (
            <div className="mt-3 flex flex-wrap gap-2">
              {t.chips.map((c) => (
                <button key={c} type="button" disabled={busy} onClick={() => void send(c)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[14px] hover:border-brand disabled:opacity-60">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {error && (
          <p role="alert" className="mx-3 mb-2 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-700 sm:mx-4">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label={t.cancel} className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </p>
        )}
        {meta && (meta.waiting || answersAi) && <p className="px-4 pb-1.5 text-center text-[12px] text-muted">{meta.waiting ? t.noteWaiting : t.noteAi}</p>}
      </div>
      <div className="bg-white">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => void send(input)}
            onPick={meta ? setPicked : undefined}
            busy={busy}
            uploading={Boolean(uploading)}
            placeholder={t.placeholder}
            sendLabel={t.send}
            attachLabel={t.attach}
            maxLength={CHAT_TEXT_MAX}
          />
        </div>
      </div>

      {/* «Загрузить» under a curator's request: the kind of the document is already known. */}
      <input
        ref={asked}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f && askedKind.current) void upload(f, askedKind.current);
        }}
      />

      {picked && meta && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal="true" aria-label={t.sheetTitle} onClick={() => setPicked(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[18px] font-bold">{t.sheetTitle}</p>
            <p className="mt-0.5 truncate text-[13px] text-muted">{picked.name}</p>
            <div className="mt-3 grid gap-2">
              {meta.uploads.map((kind) => (
                <button key={kind} type="button" onClick={() => void upload(picked, kind)} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3 text-left hover:border-brand">
                  <FileText className="h-5 w-5 shrink-0 text-brand" />
                  <span className="text-[15px] font-semibold">{FILE_SHORT[kind as FileKind]?.[locale] ?? kind}</span>
                </button>
              ))}
              <button type="button" onClick={() => void upload(picked, "other")} className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3 text-left hover:border-brand">
                <Headset className="h-5 w-5 shrink-0 text-muted" />
                <span>
                  <span className="block text-[15px] font-semibold">{t.other}</span>
                  <span className="block text-[12.5px] text-muted">{t.otherHint}</span>
                </span>
              </button>
            </div>
            {meta.uploads.length > 0 && <p className="mt-3 text-[12.5px] text-muted">{t.sheetHint}</p>}
            <button type="button" onClick={() => setPicked(null)} className={clsx("btn-ghost mt-3 w-full")}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

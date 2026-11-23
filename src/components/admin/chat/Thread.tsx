"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Bot, CircleCheck, FileText, LayoutTemplate, Loader2, PanelRight, StickyNote, X } from "lucide-react";
import { MAX_UPLOAD_BYTES } from "@/lib/cabinet/fields";
import { compressForUpload } from "@/lib/compress-file";
import { CHAT_TEMPLATES } from "@/lib/chat/templates";
import { STAFF_TEXT_MAX, newMessageKey, type ChatMessageView, type ChatMode } from "@/lib/chat/types";
import { Composer } from "@/components/chat/Composer";
import { useCoverScreen } from "@/components/chat/cover";
import { useChatFeed } from "@/components/chat/live";
import { Messages, type LocalMessage } from "@/components/chat/Messages";
import { agoLabel, useNow } from "@/components/chat/now";
import { Avatar } from "./Avatar";
import type { BroadcastParty } from "./Broadcast";
import { Profile } from "./Profile";

type Meta = {
  ok: boolean;
  client: { name: string; number: number | null; managerName: string | null; service: string };
  assistant: boolean;
  mode: ChatMode;
  waiting: boolean;
  waitingSince: string | null;
  clientReadAt: string | null;
  unread: number;
  messages: ChatMessageView[];
  have: string[];
  canWrite: boolean;
  live: string | null;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const GENERIC = "Не получилось. Попробуйте ещё раз.";
const errorOf = async (res: Response) => ((await res.json().catch(() => null)) as { message?: string } | null)?.message || GENERIC;

export type ThreadProps = {
  id: string;
  /** Name and number from the list, shown until the chat itself has loaded. */
  hint?: { name: string; number?: number };
  myName: string;
  profileOpen: boolean;
  onBack: () => void;
  onProfile: (open: boolean) => void;
  onOpenChat: (id: string) => void;
  /** The list of chats is out of date (we answered, closed the question, read the chat). */
  onChanged: () => void;
  onBroadcast: (party: BroadcastParty) => void;
};

/** One chat as the team sees it, with the client's profile next to it. Covers the screen on a phone. */
export function Thread({ id, hint, myName, profileOpen, onBack, onProfile, onOpenChat, onChanged, onBroadcast }: ThreadProps) {
  const { messages, meta, failed, loading, refresh } = useChatFeed<Meta>(`/api/admin/chat?id=${encodeURIComponent(id)}`);
  const now = useNow();
  const [locals, setLocals] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ file: File; key: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const known = new Set(messages.map((m) => m._key));
  const list: LocalMessage[] = [...messages, ...locals.filter((l) => !known.has(l._key))];
  const tail = list.length ? `${list.length}:${list[list.length - 1].text.length}` : "";

  // On a phone the chat covers the page and follows the on-screen keyboard; on a wide screen it is a column.
  const shell = useCoverScreen<HTMLElement>(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, 1024);

  // New messages keep the view at the bottom unless the reader scrolled up to look at older ones.
  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [tail]);

  // Opening the chat takes its new messages off the counter (for the whole team).
  const unread = meta?.unread ?? 0;
  const canWrite = meta?.canWrite ?? false;
  useEffect(() => {
    if (!unread || !canWrite) return;
    const mark = () => {
      if (document.hidden) return;
      void fetch("/api/admin/chat/read", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ id }) })
        .then(onChanged)
        .catch(() => null);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [unread, canWrite, id, onChanged]);

  async function send(retry?: LocalMessage) {
    const text = (retry ? retry.text : input).trim();
    if (!text || busy) return;
    const asNote = retry ? retry.kind === "note" : note;
    const key = retry?._key ?? newMessageKey();
    setError(null);
    setTemplates(false);
    if (!retry) setInput("");
    setBusy(true);
    stick.current = true;
    setLocals((l) => [...l.filter((x) => x._key !== key), { _key: key, at: new Date().toISOString(), from: "staff", kind: asNote ? "note" : "text", text, byName: myName, local: "sending" }]);
    try {
      const res = await fetch("/api/admin/chat", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ id, text, note: asNote, key }) });
      if (!res.ok) throw new Error(await errorOf(res));
      await refresh();
      setLocals((l) => l.filter((x) => x._key !== key));
    } catch (err) {
      setLocals((l) => l.map((x) => (x._key === key ? { ...x, local: "failed" } : x)));
      setError(err instanceof Error && err.message ? err.message : GENERIC);
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function sendFile() {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    stick.current = true;
    try {
      const ready = await compressForUpload(file.file);
      if (ready.size > MAX_UPLOAD_BYTES) throw new Error("Файл больше 4 МБ. Сожмите его или сфотографируйте заново.");
      const fd = new FormData();
      fd.append("file", ready);
      fd.append("text", input.trim());
      fd.append("key", file.key);
      const res = await fetch(`/api/admin/chat/file?id=${encodeURIComponent(id)}`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await errorOf(res));
      setFile(null);
      setInput("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC);
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function resolve() {
    setResolving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat/resolve", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error(await errorOf(res));
      await refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC);
    } finally {
      setResolving(false);
      onChanged();
    }
  }

  function applyTemplate(text: string) {
    setInput((v) => (v.trim() ? `${v.trim()}\n\n${text}` : text).slice(0, STAFF_TEXT_MAX));
    setTemplates(false);
  }

  const name = meta?.client.name ?? hint?.name ?? "Клиент";
  const number = meta?.client.number ?? hint?.number ?? null;
  const mode = meta?.mode ?? "ai";
  const waiting = Boolean(meta?.waiting);
  const assistant = meta?.assistant ?? true;
  const waited = agoLabel(meta?.waitingSince, now);
  const status = !meta ? "" : waiting ? `Ждёт ответа${waited && waited !== "только что" ? ` · ${waited}` : ""}` : mode === "human" ? (assistant ? "Ведёт куратор · ИИ молчит" : "Отвечают кураторы") : assistant ? "Отвечает помощник (ИИ)" : "Отвечают кураторы";
  const tip = note
    ? "Заметку видит только команда. Клиент её не получит."
    : !assistant
      ? waiting
        ? "Клиент ждёт ответа."
        : ""
      : waiting
        ? "Клиент ждёт человека. ИИ молчит, пока вы не нажмёте «Решено»."
        : mode === "human"
          ? "Чат ведёт куратор, ИИ молчит. Когда вопрос закрыт, нажмите «Решено»: дальше снова отвечает ИИ."
          : "Клиенту отвечает ИИ. Напишите сообщение, и чат перейдёт к вам.";
  const asked = messages.filter((m) => m.action === "upload" && m.doc).map((m) => m.doc as string);

  return (
    <>
      <section ref={shell} className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col bg-surface lg:static lg:z-auto lg:h-auto lg:min-w-0 lg:flex-1">
        <header className="flex items-center gap-1.5 border-b border-line bg-white px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 lg:pt-2">
          <button type="button" onClick={onBack} aria-label="К списку чатов" title="К списку чатов" className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full hover:bg-surface lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => onProfile(!profileOpen)} title="Профиль клиента" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-0.5 text-left hover:bg-surface">
            <Avatar name={name} className="max-sm:h-9 max-sm:w-9 max-sm:text-[13px]" />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[16px] leading-tight font-bold">{name}</span>
                {number != null && <span className="hidden shrink-0 text-[13px] text-muted tabular-nums sm:inline">№{number}</span>}
              </span>
              <span className="flex items-center gap-1 text-[13px] text-muted">
                {number != null && <span className="shrink-0 tabular-nums sm:hidden">№{number} ·</span>}
                {meta && !waiting && mode === "ai" && assistant && <Bot className="h-3.5 w-3.5 shrink-0" />}
                {waiting && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}
                {meta && !waiting && (mode === "human" || !assistant) && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                <span className={clsx("truncate", waiting && "font-semibold text-orange-600")}>{status}</span>
              </span>
            </span>
          </button>
          {canWrite && (waiting || mode === "human") && (
            <button
              type="button"
              onClick={resolve}
              disabled={resolving}
              title={assistant ? "Вопрос закрыт: дальше снова отвечает ИИ" : "Вопрос закрыт"}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[14px] font-semibold text-[#0a7a42] hover:bg-accent/20 disabled:opacity-60"
            >
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
              Решено
            </button>
          )}
          <button
            type="button"
            onClick={() => onProfile(!profileOpen)}
            aria-label="Профиль клиента"
            aria-pressed={profileOpen}
            title="Профиль клиента"
            className={clsx("hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex", profileOpen ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface hover:text-ink")}
          >
            <PanelRight className="h-5 w-5" />
          </button>
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
                <p>Не получилось открыть чат.</p>
                <button type="button" onClick={() => void refresh()} className="btn-ghost mt-3 min-h-10 px-4 text-[14px]">
                  Повторить
                </button>
              </div>
            )}
            {meta && (
              <Messages
                messages={list}
                viewer="team"
                docUrl={(kind) => `/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}&view=1`}
                have={meta.have}
                clientReadAt={meta.clientReadAt}
                onRetry={(m) => void send(m)}
                intro={
                  list.length === 0 ? (
                    <p className="mx-auto max-w-sm rounded-2xl bg-white px-4 py-3 text-center text-[14.5px] text-muted">
                      Переписки ещё нет. {meta.canWrite ? "Напишите первым: клиент увидит сообщение в своём кабинете." : "Здесь появятся сообщения клиента и ответы."}
                    </p>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          {error && (
            <p role="alert" className="mx-3 mb-2 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-700 sm:mx-4">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Закрыть" className="shrink-0">
                <X className="h-4 w-4" />
              </button>
            </p>
          )}
          {meta && canWrite && tip && <p className="px-4 pb-1.5 text-center text-[12px] text-muted">{tip}</p>}
        </div>

        {meta && !canWrite && <p className="border-t border-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[14px] text-muted">Вы читаете этот чат. Клиенту отвечают ведущий и менеджеры.</p>}
        {meta && canWrite && (
          <div className="bg-white">
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => void (file ? sendFile() : send())}
                onPick={note ? undefined : (f) => setFile({ file: f, key: newMessageKey() })}
                busy={busy}
                placeholder={note ? "Заметка для команды…" : file ? "Подпись к файлу (необязательно)" : "Сообщение клиенту…"}
                sendLabel="Отправить"
                attachLabel="Прикрепить файл"
                maxLength={STAFF_TEXT_MAX}
                tone={note ? "note" : "plain"}
                allowEmpty={Boolean(file)}
              >
                {templates && (
                  <div className="mb-2 max-h-64 overflow-y-auto rounded-xl border border-line bg-white shadow-[0_8px_24px_-12px_rgba(11,15,36,0.3)]">
                    {CHAT_TEMPLATES.map((t) => (
                      <button key={t.title} type="button" onClick={() => applyTemplate(t.text)} className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-surface">
                        <span className="block text-[14px] font-semibold">{t.title}</span>
                        <span className="block truncate text-[12.5px] text-muted">{t.text}</span>
                      </button>
                    ))}
                  </div>
                )}
                {file && (
                  <p className="mb-2 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[14px]">
                    <FileText className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate">{file.file.name}</span>
                    <button type="button" onClick={() => setFile(null)} disabled={busy} aria-label="Убрать файл" className="shrink-0 text-muted hover:text-ink">
                      <X className="h-4 w-4" />
                    </button>
                  </p>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <div className="inline-flex rounded-full bg-surface p-0.5 text-[13.5px] font-semibold">
                    <button type="button" aria-pressed={!note} onClick={() => setNote(false)} className={clsx("rounded-full px-3 py-1", !note ? "bg-white text-ink shadow-[0_1px_2px_rgba(11,15,36,0.12)]" : "text-muted hover:text-ink")}>
                      Клиенту
                    </button>
                    <button
                      type="button"
                      aria-pressed={note}
                      onClick={() => {
                        setNote(true);
                        setFile(null);
                      }}
                      className={clsx("flex items-center gap-1 rounded-full px-3 py-1", note ? "bg-[#fff3c4] text-ink shadow-[0_1px_2px_rgba(11,15,36,0.12)]" : "text-muted hover:text-ink")}
                    >
                      <StickyNote className="h-3.5 w-3.5" /> Заметка
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-expanded={templates}
                    onClick={() => setTemplates((v) => !v)}
                    className={clsx("ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold", templates ? "border-brand text-brand" : "border-line hover:border-brand")}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" /> Шаблоны
                  </button>
                </div>
              </Composer>
            </div>
          </div>
        )}
      </section>

      {profileOpen && (
        <Profile
          id={id}
          stamp={`${messages.length}|${meta?.have.join(",") ?? ""}`}
          canWrite={canWrite}
          asked={asked}
          onClose={() => onProfile(false)}
          onOpenChat={onOpenChat}
          onAsked={() => {
            stick.current = true;
            void refresh();
            onChanged();
          }}
          onBroadcast={onBroadcast}
        />
      )}
    </>
  );
}

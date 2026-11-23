"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, Loader2, Paperclip, Search, Send, X } from "lucide-react";
import type { ChatProfile, ChatRow } from "@/lib/chat/admin";
import { MANAGER_UPLOAD_KINDS, type FileKind } from "@/lib/cabinet/fields";
import { newMessageKey } from "@/lib/chat/types";
import { compressForUpload } from "@/lib/compress-file";
import { Avatar } from "./chat/Avatar";

const SHARE = "aw-share";
/** Where a shared file goes: one of the client's documents, or the client's chat (it is saved to documents too). */
type Target = "chat" | FileKind;
type Shared = { id: string; file: File; target: Target; state: "wait" | "sending" | "done" | "error"; error?: string };

/** The Android app hands shared files over through `window.AlemWayShare` (see mobile/ MainActivity). */
let nativeTaken: File[] | null = null;
function readNative(): File[] {
  // The app hands the files over once; keep them for this page's life.
  if (nativeTaken) return nativeTaken;
  const bridge = (window as Window & { AlemWayShare?: { take(): string } }).AlemWayShare;
  if (!bridge) return [];
  try {
    const list = JSON.parse(bridge.take()) as { name: string; type: string; data: string }[];
    nativeTaken = list.map((f) => new File([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
  } catch {
    nativeTaken = [];
  }
  return nativeTaken;
}

async function readShared(): Promise<{ files: File[]; text: string }> {
  const native = readNative();
  if (native.length) return { files: native, text: "" };
  if (!("caches" in window)) return { files: [], text: "" };
  const cache = await caches.open(SHARE);
  const files: File[] = [];
  let text = "";
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (!res) continue;
    if (req.url.endsWith("/share-inbox/text")) {
      text = await res.text();
      continue;
    }
    const name = decodeURIComponent(res.headers.get("X-Name") ?? "file");
    files.push(new File([await res.blob()], name, { type: res.headers.get("Content-Type") ?? "" }));
  }
  return { files, text };
}

async function clearShared() {
  if ("caches" in window) await caches.delete(SHARE);
}

const isManagerKind = (k: string): k is FileKind => (MANAGER_UPLOAD_KINDS as readonly string[]).includes(k);

/**
 * A file shared to AlemWay from WhatsApp or the gallery (Android «Поделиться»), or picked by hand:
 * the team member finds the client and puts the file into their card or their chat.
 */
export function ShareInbox({ full, lost }: { full: boolean; lost: boolean }) {
  const [items, setItems] = useState<Shared[]>([]);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState<ChatProfile | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const add = (files: File[]) =>
    setItems((list) => [...list, ...files.map((file) => ({ id: crypto.randomUUID(), file, target: "chat" as Target, state: "wait" as const }))]);

  useEffect(() => {
    let dead = false;
    void readShared()
      .then(({ files, text }) => {
        if (dead) return;
        add(files);
        setNote(text);
      })
      .catch(() => {})
      .finally(() => !dead && setLoaded(true));
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    let dead = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/chat/list?tab=all&q=${encodeURIComponent(text)}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (!dead) {
        setRows(data?.rows ?? []);
        setSearching(false);
      }
    }, 300);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [q]);

  async function pick(id: string) {
    setOpening(id);
    const res = await fetch(`/api/admin/chat?id=${encodeURIComponent(id)}&profile=1&after=9`, { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setOpening(null);
    if (!data?.profile) return;
    setClient(data.profile as ChatProfile);
    // «Отдел продаж» cannot write in chats: their files go to the contract.
    if (!full) setItems((list) => list.map((x) => (x.state === "done" ? x : { ...x, target: "contract" })));
  }

  const kinds = (client?.files ?? []).filter((f) => isManagerKind(f.kind) && (full || f.kind === "contract"));
  const setItem = (id: string, patch: Partial<Shared>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function sendAll() {
    if (!client) return;
    setSending(true);
    for (const it of items) {
      if (it.state === "done") continue;
      setItem(it.id, { state: "sending", error: undefined });
      const form = new FormData();
      form.append("file", await compressForUpload(it.file));
      let url: string;
      if (it.target === "chat") {
        form.append("key", newMessageKey());
        url = `/api/admin/chat/file?id=${encodeURIComponent(client.id)}`;
      } else {
        url = `/api/admin/cabinet/upload?id=${encodeURIComponent(client.id)}&kind=${it.target}`;
      }
      const res = await fetch(url, { method: "POST", body: form }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (res?.ok && data?.ok !== false) setItem(it.id, { state: "done" });
      else setItem(it.id, { state: "error", error: data?.error ?? "Нет связи. Попробуйте ещё раз." });
    }
    setSending(false);
  }

  const allDone = items.length > 0 && items.every((x) => x.state === "done");
  useEffect(() => {
    if (allDone) void clearShared();
  }, [allDone]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-bold">Файл в карточку клиента</h1>
        <p className="mt-1 text-[14px] text-muted">
          В WhatsApp или галерее нажмите «Поделиться» и выберите AlemWay. Файл появится здесь: найдите клиента и отправьте.
        </p>
      </div>

      {lost && items.length === 0 && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">Файл не дошёл: приложение ещё только устанавливалось. Поделитесь им ещё раз или выберите вручную.</p>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Файлы</h2>
          <button type="button" className="btn-ghost min-h-10 px-3 text-[14px]" onClick={() => picker.current?.click()}>
            <Paperclip className="h-4 w-4" /> Выбрать файл
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              add(files);
            }}
          />
        </div>
        {!loaded ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        ) : items.length === 0 ? (
          <p className="text-[14px] text-muted">Пока нет файлов.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText className="h-5 w-5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{it.file.name}</p>
                    <p className="text-[12.5px] text-muted">{Math.max(1, Math.round(it.file.size / 1024))} КБ</p>
                    {it.error && <p className="text-[12.5px] text-red-600">{it.error}</p>}
                  </div>
                </div>
                {it.state === "done" ? (
                  <span className="flex items-center gap-1 text-[14px] font-medium text-accent">
                    <Check className="h-4 w-4" /> Отправлено
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Куда положить файл"
                      className="min-h-10 rounded-lg border border-line bg-white px-2 text-[14px]"
                      value={it.target}
                      disabled={!client || sending}
                      onChange={(e) => setItem(it.id, { target: e.target.value as Target })}
                    >
                      {full && <option value="chat">В чат клиенту</option>}
                      {kinds.map((k) => (
                        <option key={k.kind} value={k.kind}>
                          {k.label}
                          {k.state === "ok" ? " (заменить)" : ""}
                        </option>
                      ))}
                    </select>
                    {it.state === "sending" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted" />
                    ) : (
                      <button type="button" aria-label="Убрать файл" disabled={sending} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-line/40" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[13px] whitespace-pre-wrap text-muted">{note}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-[15px] font-semibold">Клиент</h2>
        {client ? (
          <div className="flex items-center gap-3">
            <Avatar name={client.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{client.name}</p>
              <p className="text-[13px] text-muted">
                {client.number ? `№${client.number} · ` : ""}
                {client.serviceTitle}
              </p>
            </div>
            {!sending && !allDone && (
              <button type="button" className="text-[14px] font-medium text-brand hover:underline" onClick={() => setClient(null)}>
                Другой
              </button>
            )}
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-line px-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                type="search"
                className="min-h-11 flex-1 bg-transparent text-[15px] outline-none"
                placeholder="Имя, телефон или номер клиента"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (e.target.value.trim().length < 2) setRows([]);
                }}
              />
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            </label>
            <ul className="mt-2 flex flex-col">
              {rows.map((r) => (
                <li key={r.cabinet}>
                  <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface" onClick={() => pick(r.cabinet)}>
                    <Avatar name={r.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.name}</span>
                      <span className="block text-[13px] text-muted">
                        {r.number ? `№${r.number}` : ""}
                        {r.managerName ? ` · ${r.managerName}` : ""}
                      </span>
                    </span>
                    {opening === r.cabinet && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {allDone && client ? (
        <Link href={`/admin/chats?c=${encodeURIComponent(client.id)}`} className="btn-primary min-h-12 justify-center text-[15px]">
          Готово. Открыть чат клиента
        </Link>
      ) : (
        <button type="button" className="btn-primary min-h-12 justify-center text-[15px]" disabled={!client || items.length === 0 || sending} onClick={sendAll}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Отправить
        </button>
      )}
    </div>
  );
}

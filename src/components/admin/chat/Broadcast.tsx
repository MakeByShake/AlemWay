"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Megaphone, X } from "lucide-react";
import type { BroadcastRow, Recipient } from "@/lib/chat/admin";
import { PIPELINES, type ServiceId } from "@/lib/cabinet/fields";
import { CHAT_TEMPLATES } from "@/lib/chat/templates";
import { stageTitle } from "@/lib/chat/texts";
import { STAFF_TEXT_MAX } from "@/lib/chat/types";
import { fmtDate } from "@/components/admin/bits";

/** «Написать всем» from a profile: the friends who travel with this client. */
export type BroadcastParty = { id: string; name: string; number?: number };

const SERVICES: { value: "" | ServiceId; title: string }[] = [
  { value: "", title: "Все услуги" },
  { value: "ferienjob", title: "Германия" },
  { value: "keta", title: "K-ETA" },
];
const MISSING = [
  { value: "", title: "Не важно" },
  { value: "passport", title: "Нет паспорта" },
  { value: "enrollment", title: "Нет справки с учёбы" },
  { value: "signed", title: "Нет декларации с печатью" },
  { value: "photo", title: "Нет фото (K-ETA)" },
];
/** Stages a broadcast can go to: finished clients never get one. */
function stagesFor(service: "" | ServiceId) {
  const steps = service ? PIPELINES[service] : [...PIPELINES.ferienjob, ...PIPELINES.keta];
  const seen = new Set<string>();
  return steps.filter((s) => s.status !== "done" && !seen.has(s.status) && seen.add(s.status)).map((s) => ({ value: s.status as string, title: stageTitle(s.status) }));
}

const people = (n: number) => {
  const d = n % 10;
  const h = n % 100;
  return `${n} ${d === 1 && h !== 11 ? "клиенту" : "клиентам"}`;
};
const field = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/**
 * One message to many clients, by hand: choose who (stage, a missing document, only mine, or a group of friends),
 * look through the list, write, confirm. Everyone gets it in their own chat. «Отправленные» shows who has read it.
 */
export function Broadcast({ party, onClose, onSent, onOpenChat }: { party?: BroadcastParty; onClose: () => void; onSent: () => void; onOpenChat: (id: string) => void }) {
  const [view, setView] = useState<"new" | "sent">("new");
  const [group, setGroup] = useState<BroadcastParty | undefined>(party);
  const [service, setService] = useState<"" | ServiceId>("");
  const [status, setStatus] = useState("");
  const [missing, setMissing] = useState("");
  const [mine, setMine] = useState(false);
  const [found, setFound] = useState<{ key: string; list: Recipient[] } | null>(null);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [sent, setSent] = useState<BroadcastRow[] | null>(null);
  const [sentFailed, setSentFailed] = useState(false);

  // The page behind stays still; Esc closes the window.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const key = group ? `party:${group.id}` : `${service}|${status}|${missing}|${mine ? 1 : 0}`;
  useEffect(() => {
    let dead = false;
    const timer = setTimeout(async () => {
      const q = new URLSearchParams({ preview: "1" });
      if (group) q.set("partyOf", group.id);
      else {
        if (service) q.set("service", service);
        if (status) q.set("status", status);
        if (missing) q.set("missing", missing);
        if (mine) q.set("mine", "1");
      }
      const res = await fetch(`/api/admin/chat/broadcast?${q.toString()}`, { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? ((await res.json().catch(() => null)) as { ok?: boolean; recipients?: Recipient[] } | null) : null;
      if (dead) return;
      setFound({ key: group ? `party:${group.id}` : `${service}|${status}|${missing}|${mine ? 1 : 0}`, list: json?.ok ? (json.recipients ?? []) : [] });
      setOff(new Set());
      setError(json?.ok ? null : "Не получилось загрузить список клиентов.");
    }, 150);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [group, service, status, missing, mine]);

  useEffect(() => {
    if (view !== "sent") return;
    let dead = false;
    void (async () => {
      const res = await fetch("/api/admin/chat/broadcast", { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? ((await res.json().catch(() => null)) as { ok?: boolean; sent?: BroadcastRow[] } | null) : null;
      if (dead) return;
      setSent(json?.ok ? (json.sent ?? []) : []);
      setSentFailed(!json?.ok);
    })();
    return () => {
      dead = true;
    };
  }, [view, done]);

  const list = found && found.key === key ? found.list : null;
  const chosen = list?.filter((r) => !off.has(r.id)) ?? [];
  const stages = stagesFor(service);

  /** What the record of the broadcast says about who it went to. */
  function describe() {
    if (group) return `Группа друзей: ${group.number != null ? `№${group.number} ` : ""}${group.name}`;
    const parts = [
      service ? SERVICES.find((s) => s.value === service)?.title : "",
      status ? `этап «${stageTitle(status)}»` : "",
      missing ? (MISSING.find((m) => m.value === missing)?.title ?? "").toLowerCase() : "",
      mine ? "только мои клиенты" : "",
    ].filter(Boolean);
    const base = parts.length ? parts.join(", ") : "все клиенты в работе";
    return list && chosen.length < list.length ? `${base} (выбрано ${chosen.length} из ${list.length})` : base;
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), ids: chosen.map((r) => r.id), filter: describe() }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; sent?: number; message?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.message || "Не получилось отправить. Попробуйте ещё раз.");
      setDone(json.sent ?? chosen.length);
      setText("");
      setConfirm(false);
      setView("sent");
      onSent();
    } catch (err) {
      setConfirm(false);
      setError(err instanceof Error ? err.message : "Не получилось отправить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const ready = text.trim().length > 0 && chosen.length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Рассылка" onClick={onClose}>
      <div className="flex h-dvh w-full flex-col bg-white sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <Megaphone className="h-5 w-5 shrink-0 text-brand" />
          <p className="text-[18px] font-bold">Рассылка</p>
          <div className="ml-auto inline-flex rounded-full bg-surface p-0.5 text-[13.5px] font-semibold">
            <button type="button" aria-pressed={view === "new"} onClick={() => setView("new")} className={clsx("rounded-full px-3 py-1", view === "new" ? "bg-white shadow-[0_1px_2px_rgba(11,15,36,0.12)]" : "text-muted hover:text-ink")}>
              Новая
            </button>
            <button type="button" aria-pressed={view === "sent"} onClick={() => setView("sent")} className={clsx("rounded-full px-3 py-1", view === "sent" ? "bg-white shadow-[0_1px_2px_rgba(11,15,36,0.12)]" : "text-muted hover:text-ink")}>
              Отправленные
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </header>

        {view === "new" ? (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
              <p className="text-[14px] text-muted">Сообщение придёт каждому в его чат с AlemWay, от вашего имени. Чат при этом остаётся у ИИ, пока клиент не позовёт человека.</p>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold tracking-wide text-muted uppercase">Кому</p>
                {group ? (
                  <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-[14.5px]">
                    <span className="min-w-0 flex-1">
                      Группа друзей клиента{" "}
                      <b>
                        {group.number != null ? `№${group.number} ` : ""}
                        {group.name}
                      </b>
                    </span>
                    <button type="button" onClick={() => setGroup(undefined)} className="shrink-0 text-[13px] font-semibold text-brand hover:underline">
                      Выбрать по-другому
                    </button>
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={service}
                      onChange={(e) => {
                        setService(e.target.value as "" | ServiceId);
                        setStatus("");
                      }}
                      aria-label="Услуга"
                      className={field}
                    >
                      {SERVICES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Этап" className={field}>
                      <option value="">Любой этап</option>
                      {stages.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <select value={missing} onChange={(e) => setMissing(e.target.value)} aria-label="Какого документа нет" className={field}>
                      {MISSING.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.value ? m.title : "Документы: любые"}
                        </option>
                      ))}
                    </select>
                    <label className="flex min-h-11 items-center gap-2 text-[14.5px] sm:col-span-3">
                      <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--color-brand)]" />
                      Только клиенты, которых веду я
                    </label>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{list ? `Получат: ${chosen.length} из ${list.length}` : "Получат"}</p>
                  {list && list.length > 1 && (
                    <button type="button" onClick={() => setOff(chosen.length ? new Set(list.map((r) => r.id)) : new Set())} className="text-[13px] font-semibold text-brand hover:underline">
                      {chosen.length ? "Снять все" : "Выбрать все"}
                    </button>
                  )}
                </div>
                {list === null ? (
                  <p className="flex justify-center rounded-xl border border-line py-6 text-muted">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </p>
                ) : list.length === 0 ? (
                  <p className="rounded-xl border border-line px-3 py-5 text-center text-[14.5px] text-muted">Под эти условия никто не подходит.</p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto rounded-xl border border-line">
                    {list.map((r) => (
                      <li key={r.id} className="border-b border-line last:border-b-0">
                        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[14.5px] hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={!off.has(r.id)}
                            onChange={(e) =>
                              setOff((old) => {
                                const next = new Set(old);
                                if (e.target.checked) next.delete(r.id);
                                else next.add(r.id);
                                return next;
                              })
                            }
                            className="h-[18px] w-[18px] shrink-0 accent-[var(--color-brand)]"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                          {r.number != null && <span className="shrink-0 text-[12.5px] text-muted tabular-nums">№{r.number}</span>}
                          <span className="hidden max-w-[40%] shrink-0 truncate text-[12.5px] text-muted sm:inline">{stageTitle(r.status ?? "waiting_data")}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="bc-text" className="text-[13px] font-semibold tracking-wide text-muted uppercase">
                    Сообщение
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const t = CHAT_TEMPLATES.find((x) => x.title === e.target.value);
                      if (t) setText((v) => (v.trim() ? `${v.trim()}\n\n${t.text}` : t.text).slice(0, STAFF_TEXT_MAX));
                    }}
                    aria-label="Вставить шаблон"
                    className="max-w-[60%] rounded-lg border border-line bg-white px-2 py-1 text-[13px] font-semibold text-brand"
                  >
                    <option value="">Вставить шаблон…</option>
                    {CHAT_TEMPLATES.map((t) => (
                      <option key={t.title} value={t.title}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  id="bc-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  maxLength={STAFF_TEXT_MAX}
                  placeholder="Текст, который увидит каждый клиент…"
                  className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] leading-snug outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-700">
                  {error}
                </p>
              )}
            </div>

            <footer className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {confirm ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-[14.5px]">
                    Отправить сообщение <b>{people(chosen.length)}</b>? Вернуть его потом нельзя.
                  </p>
                  <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="btn-ghost min-h-11 px-4 text-[14.5px]">
                    Назад
                  </button>
                  <button type="button" onClick={() => void send()} disabled={busy} className="btn-primary min-h-11 px-4 text-[14.5px] disabled:opacity-60">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Да, отправить
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirm(true)} disabled={!ready} className="btn-primary min-h-11 w-full text-[15px] disabled:opacity-50">
                  {chosen.length ? `Отправить ${people(chosen.length)}` : "Выберите хотя бы одного клиента"}
                </button>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {done !== null && (
              <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[14.5px] font-medium text-[#0a7a42]">
                <Check className="h-4 w-4 shrink-0" /> Отправлено {people(done)}. Ниже видно, кто уже прочитал.
              </p>
            )}
            {sent === null ? (
              <p className="flex justify-center py-10 text-muted">
                <Loader2 className="h-6 w-6 animate-spin" />
              </p>
            ) : sent.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted">{sentFailed ? "Не получилось загрузить список." : "Рассылок ещё не было."}</p>
            ) : (
              sent.map((b) => (
                <article key={b.id} className="rounded-2xl border border-line p-3">
                  <p className="text-[12.5px] text-muted">
                    {fmtDate(b.at)}
                    {b.byName ? ` · ${b.byName}` : ""}
                    {b.filter ? ` · ${b.filter}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-4 text-[14.5px] whitespace-pre-line">{b.text}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${b.total ? Math.round((b.read / b.total) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-1 text-[13.5px] font-semibold">
                    Прочитали {b.read} из {b.total}
                  </p>
                  {b.unread.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[13.5px] font-semibold text-brand">Кто ещё не прочитал ({b.unread.length})</summary>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {b.unread.map((u) => (
                          <li key={u.id}>
                            <button type="button" onClick={() => onOpenChat(u.id)} title="Открыть чат" className="rounded-full border border-line px-2.5 py-1 text-[13px] hover:border-brand">
                              {u.name}
                              {u.number != null ? ` №${u.number}` : ""}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

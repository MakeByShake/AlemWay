"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Loader2, Megaphone, MessagesSquare, Search, X } from "lucide-react";
import type { ChatRow, ChatTab } from "@/lib/chat/admin";
import { isCabinetId } from "@/lib/chat/types";
import { agoLabel, shortWhen, useNow } from "@/components/chat/now";
import { Avatar } from "./Avatar";
import { Broadcast, type BroadcastParty } from "./Broadcast";
import { loadInbox, setInboxCounts, useInbox } from "./inbox";
import { Thread } from "./Thread";

type ListResponse = { ok?: boolean; rows: ChatRow[]; counts: { waiting: number; mine: number }; live: string | null };

// ---------- The open chat, the profile and the tab live in the address ----------
// So a page refresh keeps them, and the phone's «назад» closes the profile, then the chat, then leaves the section.

type UrlChange = { c?: string | null; p?: boolean; tab?: ChatTab };
/** Our note on a history entry: how many entries we added above the plain list, and whether this one only added the profile. */
type Mark = { depth: number; p: boolean };

function mark(): Mark | null {
  const m = (window.history.state as { awChat?: Mark } | null)?.awChat;
  return m && typeof m.depth === "number" ? m : null;
}

/** push — a new history entry; switch — the same entry now shows another chat; replace — a small change (tab). */
function setUrl(change: UrlChange, how: "push" | "replace" | "switch" = "replace") {
  const q = new URLSearchParams(window.location.search);
  if (change.c !== undefined) {
    if (change.c) q.set("c", change.c);
    else q.delete("c");
  }
  if (change.p !== undefined) {
    if (change.p) q.set("p", "1");
    else q.delete("p");
  }
  if (change.tab) {
    if (change.tab === "waiting") q.delete("tab");
    else q.set("tab", change.tab);
  }
  const qs = q.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  const m = mark();
  // Always a fresh state object: Next.js adds its own fields to it and then follows the new address.
  if (how === "push") window.history.pushState({ awChat: { depth: (m?.depth ?? 0) + 1, p: change.p === true } }, "", url);
  else window.history.replaceState(m ? { awChat: how === "switch" ? { ...m, p: false } : { ...m } } : null, "", url);
}

function closeProfile() {
  if (mark()?.p) window.history.back();
  else setUrl({ p: false }, "switch");
}

function closeThread() {
  const depth = mark()?.depth ?? 0;
  if (depth > 0) window.history.go(-depth);
  else setUrl({ c: null, p: false });
}

function openChat(id: string) {
  const q = new URLSearchParams(window.location.search);
  if (q.get("c") === id) return;
  if (!q.has("c")) return setUrl({ c: id }, "push");
  // Where the profile lies over the chat (narrower screens), a newly opened chat is shown without it.
  setUrl({ c: id, ...(window.matchMedia("(min-width: 1536px)").matches ? {} : { p: false }) }, "switch");
}

const TABS: { id: ChatTab; label: string; fullOnly?: boolean }[] = [
  { id: "waiting", label: "Ждут ответа" },
  { id: "mine", label: "Мои", fullOnly: true },
  { id: "all", label: "Все" },
];

const EMPTY: Record<ChatTab, string> = {
  waiting: "Сейчас никто не ждёт ответа.",
  mine: "У ваших клиентов пока нет переписки.",
  all: "Чатов пока нет. Найдите клиента через поиск и напишите первым.",
};

/**
 * «Чаты» of the team: the list of chats, the open chat and the client's profile.
 * A phone shows one of them at a time; a wide screen shows them side by side.
 */
export function ChatsApp({ full, myName }: { full: boolean; myName: string }) {
  const sp = useSearchParams();
  const c = sp.get("c");
  const openId = isCabinetId(c) ? c : null;
  const profileOpen = Boolean(openId) && sp.get("p") === "1";
  const tabParam = sp.get("tab");
  const tab: ChatTab = tabParam === "all" || (tabParam === "mine" && full) ? tabParam : "waiting";
  const inbox = useInbox();
  const now = useNow();

  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ key: string; rows: ChatRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [broadcast, setBroadcast] = useState<{ party?: BroadcastParty } | null>(null);

  /** Something changed by our own hand (a reply, «Решено», a read chat): the list and the counters reload. */
  const reload = useCallback(() => {
    setNonce((n) => n + 1);
    void loadInbox();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${tab}|${query}`;
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/chat/list?tab=${tab}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ListResponse | null;
        if (dead) return;
        if (!res.ok || !json?.ok) return setFailed(true);
        setFailed(false);
        setList({ key: `${tab}|${query}`, rows: json.rows });
        setInboxCounts(json.counts, json.live);
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, [tab, query, inbox.version, nonce]);

  const rows = list && list.key === key ? list.rows : null;
  const counts: Record<ChatTab, number> = { waiting: inbox.waiting, mine: inbox.mine, all: 0 };

  return (
    <div className="relative lg:flex lg:h-[calc(100dvh-4rem)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:bg-white">
      <section className="lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:border-r lg:border-line xl:w-[380px]">
        <div className="lg:px-4 lg:pt-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[26px] font-bold lg:text-[22px]">Чаты</h1>
            {full && (
              <button type="button" onClick={() => setBroadcast({})} className="btn-ghost min-h-10 gap-2 px-3.5 text-[14px]">
                <Megaphone className="h-4 w-4" /> Рассылка
              </button>
            )}
          </div>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={60}
              placeholder="Имя, телефон или № клиента"
              aria-label="Поиск клиента"
              className="min-h-11 w-full rounded-xl border border-line bg-white pr-10 pl-9 text-[15px] outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Очистить поиск" className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          {query ? (
            <p className="mt-3 text-[13px] text-muted">Поиск по всем клиентам, даже если переписки ещё нет.</p>
          ) : (
            <div className="mt-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Какие чаты показать">
              {TABS.filter((t) => full || !t.fullOnly).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setUrl({ tab: t.id })}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[14px] font-semibold",
                    tab === t.id ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
                  )}
                >
                  {t.label}
                  {counts[t.id] > 0 && (
                    <span className={clsx("min-w-5 rounded-full px-1.5 text-center text-[12px] leading-5 font-bold", tab === t.id ? "bg-white text-brand" : "bg-orange-500 text-white")}>{counts[t.id]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {failed && (
            <p role="alert" className="mx-0 mb-2 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-700 lg:mx-3">
              Не получилось загрузить чаты.
              <button type="button" onClick={reload} className="font-semibold underline">
                Повторить
              </button>
            </p>
          )}
          {rows === null ? (
            !failed && (
              <p className="flex justify-center py-10 text-muted">
                <Loader2 className="h-6 w-6 animate-spin" />
              </p>
            )
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[15px] text-muted">{query ? "Никого не нашли. Проверьте имя, телефон или номер клиента." : EMPTY[tab]}</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-line bg-white lg:rounded-none lg:border-0">
              {rows.map((r) => (
                <li key={r.cabinet} className="border-b border-line last:border-b-0">
                  <Row r={r} active={r.cabinet === openId} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {openId ? (
        <Thread
          key={openId}
          id={openId}
          hint={rows?.find((r) => r.cabinet === openId)}
          myName={myName}
          profileOpen={profileOpen}
          onBack={closeThread}
          onProfile={(on) => (on ? setUrl({ p: true }, "push") : closeProfile())}
          onOpenChat={openChat}
          onChanged={reload}
          onBroadcast={(party) => setBroadcast({ party })}
        />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-2 bg-surface px-6 text-center text-muted lg:flex">
          <MessagesSquare className="h-10 w-10" />
          <p className="text-[16px] font-semibold text-ink">Выберите чат слева</p>
          <p className="max-w-xs text-[14px]">Или найдите клиента по имени, телефону или номеру и напишите первым.</p>
        </div>
      )}

      {broadcast && (
        <Broadcast
          party={broadcast.party}
          onClose={() => setBroadcast(null)}
          onSent={reload}
          onOpenChat={(id) => {
            setBroadcast(null);
            openChat(id);
          }}
        />
      )}
    </div>
  );
}

function Row({ r, active, now }: { r: ChatRow; active: boolean; now: number }) {
  const who = r.lastFrom === "ai" ? "ИИ: " : r.lastFrom === "staff" ? "Куратор: " : "";
  const waited = agoLabel(r.waitingSince, now);
  return (
    <button
      type="button"
      onClick={() => openChat(r.cabinet)}
      aria-current={active ? "true" : undefined}
      title={r.managerName ? `Ведущий: ${r.managerName}` : undefined}
      className={clsx("flex w-full items-center gap-3 px-3 py-2.5 text-left", active ? "bg-brand-soft" : "hover:bg-surface")}
    >
      <Avatar name={r.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={clsx("truncate text-[15.5px]", r.unread > 0 || r.waiting ? "font-bold" : "font-semibold")}>{r.name}</span>
          {r.number != null && <span className="shrink-0 text-[12.5px] text-muted tabular-nums">№{r.number}</span>}
          <span className="ml-auto shrink-0 text-[12px] text-muted tabular-nums">{shortWhen(r.lastAt, now)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={clsx("min-w-0 flex-1 truncate text-[13.5px]", r.unread > 0 ? "text-ink" : "text-muted")}>{r.lastText ? `${who}${r.lastText}` : "Переписки ещё нет"}</span>
          {r.waiting && <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[11.5px] leading-4 font-bold text-white">{waited && waited !== "только что" ? `ждёт ${waited}` : "ждёт"}</span>}
          {r.unread > 0 && <span className="min-w-5 shrink-0 rounded-full bg-brand px-1.5 text-center text-[12px] leading-5 font-bold text-white">{r.unread}</span>}
        </span>
      </span>
    </button>
  );
}

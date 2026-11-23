"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessageView } from "@/lib/chat/types";

/**
 * Calls `onChange` when something changed on the server.
 * Normally the browser listens to a tiny «signal» through our own site (/api/live, `url`) and reacts at once.
 * If that connection can't be opened or goes quiet, it falls back to asking every `pollMs`. Hidden tabs do nothing.
 * `off` — don't watch at all (someone else on the page already does).
 */
export function useLive(url: string | null | undefined, onChange: () => void, pollMs = 6_000, off = false) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (off) return;
    let es: EventSource | null = null;
    let connected = false;
    let everConnected = false;
    let welcomeTimer: ReturnType<typeof setTimeout> | null = null;
    let last = Date.now();
    let retryAt = 0;
    let fails = 0;
    let soon: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      last = Date.now();
      cb.current();
    };
    // Several changes in a row (a message and its read mark) become one request.
    const fireSoon = () => {
      if (soon) return;
      soon = setTimeout(() => {
        soon = null;
        fire();
      }, 250);
    };
    const close = () => {
      if (welcomeTimer) clearTimeout(welcomeTimer);
      welcomeTimer = null;
      es?.close();
      es = null;
      connected = false;
    };
    const open = () => {
      if (!url || es || document.hidden || typeof EventSource === "undefined") return;
      try {
        es = new EventSource(url);
      } catch {
        return;
      }
      const drop = () => {
        close();
        fails += 1;
        retryAt = Date.now() + Math.min(120_000, 10_000 * fails);
      };
      // No «welcome» soon: something on the way holds the stream back, so ask regularly instead.
      welcomeTimer = setTimeout(() => !connected && drop(), 8_000);
      es.addEventListener("welcome", () => {
        if (welcomeTimer) clearTimeout(welcomeTimer);
        welcomeTimer = null;
        connected = true;
        fails = 0;
        // A reconnect (the server ends each connection after a few minutes): catch up on what came meanwhile.
        if (everConnected) fireSoon();
        everConnected = true;
      });
      es.addEventListener("mutation", fireSoon);
      es.addEventListener("channelError", drop);
      es.addEventListener("disconnect", drop);
      es.onerror = () => {
        connected = false;
        // The browser retries by itself unless the connection was refused for good.
        if (es?.readyState === EventSource.CLOSED) drop();
      };
    };
    const tick = () => {
      if (document.hidden) return;
      if (!es && Date.now() >= retryAt) open();
      // With a live connection a rare check is enough (in case an event was missed).
      if (Date.now() - last >= (connected ? 300_000 : pollMs)) fire();
    };
    const onVisible = () => {
      if (document.hidden) return close();
      open();
      if (Date.now() - last > 5_000) fire();
    };
    open();
    const timer = setInterval(tick, 5_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      clearInterval(timer);
      if (soon) clearTimeout(soon);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      close();
    };
  }, [url, pollMs, off]);
}

type FeedResponse = { ok?: boolean; messages?: ChatMessageView[]; live?: string | null };
type FeedState = { url: string | null; last: string; busy: boolean; again: boolean; dead: boolean };

/** Asks the server for the messages after the last known one. Calls made meanwhile are folded into one more round. */
async function pull<M extends FeedResponse>(s: FeedState, onData: (json: M) => void, onFail: () => void) {
  if (!s.url || s.dead) return;
  if (s.busy) {
    s.again = true;
    return;
  }
  s.busy = true;
  try {
    do {
      s.again = false;
      let json: M | null = null;
      let ok = false;
      try {
        const res = await fetch(`${s.url}${s.url.includes("?") ? "&" : "?"}${s.last ? `after=${encodeURIComponent(s.last)}` : ""}`, { cache: "no-store" });
        json = (await res.json().catch(() => null)) as M | null;
        ok = res.ok && Boolean(json?.ok);
      } catch {
        ok = false;
      }
      // Another chat was opened meanwhile: this answer is no longer needed.
      if (s.dead) return;
      if (!ok || !json) onFail();
      else {
        const fresh = json.messages ?? [];
        if (fresh.length) s.last = fresh[fresh.length - 1].at;
        onData(json);
      }
    } while (s.again);
  } finally {
    s.busy = false;
  }
}

/**
 * Messages of one chat plus the rest of what the server says about it (`meta`).
 * `url` is our API address of the chat; new messages are fetched from the last known one on.
 */
export function useChatFeed<M extends FeedResponse>(url: string | null) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [meta, setMeta] = useState<M | null>(null);
  const [failed, setFailed] = useState(false);
  const state = useRef<FeedState | null>(null);

  const refresh = useCallback(async () => {
    const s = state.current;
    if (!s) return;
    await pull<M>(
      s,
      (json) => {
        setFailed(false);
        setMeta(json);
        const fresh = json.messages ?? [];
        if (!fresh.length) return;
        setMessages((old) => {
          const byKey = new Map(old.map((m) => [m._key, m]));
          for (const m of fresh) byKey.set(m._key, m);
          return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
        });
      },
      () => setFailed(true)
    );
  }, []);

  useEffect(() => {
    const s: FeedState = { url, last: "", busy: false, again: false, dead: false };
    state.current = s;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- another chat was opened: start from an empty list
    setMessages([]);
    setMeta(null);
    setFailed(false);
    void pull<M>(
      s,
      (json) => {
        setMeta(json);
        setMessages(json.messages ?? []);
      },
      () => setFailed(true)
    );
    return () => {
      s.dead = true;
    };
  }, [url]);

  useLive(meta?.live, refresh);

  return { messages, meta, failed, loading: Boolean(url) && !meta && !failed, refresh };
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * What the «Чаты» item of the menu and the chats page share: how many clients wait for a person,
 * and `version`, which grows every time the team's list of chats changes on the server.
 * The menu owns the one live connection; the page just watches `version`.
 */
export type Inbox = { waiting: number; mine: number; live: string | null; version: number };

const EMPTY: Inbox = { waiting: 0, mine: 0, live: null, version: 0 };
let state: Inbox = EMPTY;
const subs = new Set<() => void>();

function set(next: Partial<Inbox>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export const useInbox = () => useSyncExternalStore(subscribe, () => state, () => EMPTY);

/** The chats page has loaded its list: the counters came along. */
export function setInboxCounts(counts: { waiting: number; mine: number }, live?: string | null) {
  if (counts.waiting === state.waiting && counts.mine === state.mine && (live === undefined || live === state.live)) return;
  set({ waiting: counts.waiting, mine: counts.mine, ...(live === undefined ? {} : { live }) });
}

let busy = false;
let again = false;
/** Asks the server for the counters. `changed` — the list changed on the server: whoever shows it reloads. */
export async function loadInbox(changed = false) {
  if (changed) set({ version: state.version + 1 });
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    do {
      again = false;
      const res = await fetch("/api/admin/chat/count", { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? ((await res.json().catch(() => null)) as { ok?: boolean; waiting?: number; mine?: number; live?: string | null } | null) : null;
      if (json?.ok) setInboxCounts({ waiting: json.waiting ?? 0, mine: json.mine ?? 0 }, json.live ?? null);
    } while (again);
  } finally {
    busy = false;
  }
}

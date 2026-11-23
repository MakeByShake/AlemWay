"use client";

import { useSyncExternalStore } from "react";

/** The current time for labels like «ждёт 12 мин»: one shared clock that ticks twice a minute. */
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function subscribe(f: () => void) {
  subs.add(f);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      subs.forEach((s) => s());
    }, 30_000);
  }
  return () => {
    subs.delete(f);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = null;
      now = 0;
    }
  };
}
const read = () => (now ||= Date.now());

/** Milliseconds now; 0 while the page is rendered on the server. */
export const useNow = () => useSyncExternalStore(subscribe, read, () => 0);

/** «только что», «12 мин», «3 ч», «2 дн.» — how long ago `iso` was. */
export function agoLabel(iso: string | null | undefined, nowMs: number) {
  if (!iso || !nowMs) return "";
  const min = Math.floor((nowMs - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min)) return "";
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} ч`;
  return `${Math.floor(min / 1440)} дн.`;
}

/** Time of the last message for a list row: «14:05» today, «вчера», otherwise «23.11». */
export function shortWhen(iso: string | null | undefined, nowMs: number) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date(nowMs || d.getTime());
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(d);
  if (days === 1) return "вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", ...(d.getFullYear() !== today.getFullYear() ? { year: "2-digit" } : {}) }).format(d);
}

"use client";

import { track as vercelTrack } from "@vercel/analytics";

export type Goal = "lead_submit" | "whatsapp_click" | "service_open";

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

/** Send a goal to Vercel Analytics and Yandex Metrika (if enabled). No personal data here. */
export function trackGoal(goal: Goal, params: Record<string, string> = {}) {
  try {
    vercelTrack(goal, params);
  } catch {}
  const id = Number(process.env.NEXT_PUBLIC_YM_ID);
  if (id && typeof window !== "undefined" && window.ym) {
    window.ym(id, "reachGoal", goal, params);
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE = "aw_utm";

/** Remember UTM tags from the landing URL for the whole visit. */
export function captureUtm() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) found[k.replace("utm_", "")] = v.slice(0, 200);
    }
    if (Object.keys(found).length) sessionStorage.setItem(UTM_STORAGE, JSON.stringify(found));
  } catch {}
}

export function readUtm(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_STORAGE) || "{}");
  } catch {
    return {};
  }
}

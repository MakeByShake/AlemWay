"use client";

/**
 * Keeps the client's main trip documents and trip facts on the phone, so they open without internet
 * (at the border, in the plane, at the farm). Only in the installed app (home-screen site or the Android app),
 * never in an ordinary browser tab — a shared computer keeps nothing.
 */

export type OfflineSnapshot = {
  name: string;
  savedAt: string;
  locale: "ru" | "kk";
  facts: { label: string; value: string }[];
  docs: { label: string; url: string }[];
  phone: string;
};

const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  /AlemWayApp|; wv\)/.test(navigator.userAgent);

/** Asks the service worker to download the documents and keep them with the facts. */
export async function saveOffline(snapshot: OfflineSnapshot) {
  if (!("serviceWorker" in navigator) || !installed() || !navigator.onLine) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  reg?.active?.postMessage({ type: "aw-offline-save", snapshot });
}

/** On logout: nothing of the client stays on the phone. */
export async function clearOffline() {
  navigator.serviceWorker?.controller?.postMessage({ type: "aw-offline-clear" });
  if ("caches" in window) await caches.delete("aw-docs").catch(() => false);
}

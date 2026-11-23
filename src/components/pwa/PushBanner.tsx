"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, Loader2, Share, X } from "lucide-react";

const TEXT = {
  ru: {
    ask: "Включите уведомления, чтобы не пропустить ответ куратора и новости по делу.",
    on: "Включить",
    ios: "Чтобы получать уведомления на iPhone, добавьте AlemWay на экран «Домой»: кнопка «Поделиться», затем «На экран „Домой“». Откройте AlemWay оттуда и включите уведомления.",
    denied: "Уведомления запрещены в настройках браузера. Разрешите их для alemway.kz, если хотите получать ответы сразу.",
    fail: "Не получилось включить уведомления. Попробуйте ещё раз.",
    close: "Скрыть",
  },
  kk: {
    ask: "Куратордың жауабын және ісіңіз бойынша жаңалықтарды өткізіп алмау үшін хабарландыруларды қосыңыз.",
    on: "Қосу",
    ios: "iPhone-да хабарландыру алу үшін AlemWay-ді «Үй» экранына қосыңыз: «Бөлісу» батырмасы, содан кейін «Үй экранына». AlemWay-ді сол жерден ашып, хабарландыруларды қосыңыз.",
    denied: "Хабарландыруларға браузер баптауларында тыйым салынған. Жауаптарды бірден алғыңыз келсе, alemway.kz үшін рұқсат беріңіз.",
    fail: "Хабарландыруларды қосу мүмкін болмады. Қайталап көріңіз.",
    close: "Жасыру",
  },
};

type State = "hidden" | "ask" | "ios" | "denied";
const HIDE_KEY = "aw-push-hidden";

function readState(): State {
  try {
    if (localStorage.getItem(HIDE_KEY)) return "hidden";
  } catch {
    // Storage blocked: show the banner.
  }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "hidden";
  if (Notification.permission === "granted") return "hidden";
  return Notification.permission === "denied" ? "denied" : "ask";
}

let version = 0;
const subs = new Set<() => void>();
const bump = () => {
  version++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

function toKey(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks the client to turn on notifications on this device. `publicKey` — null when the site sends none. */
export function PushBanner({ publicKey, locale }: { publicKey: string | null; locale: "ru" | "kk" }) {
  const t = TEXT[locale];
  const state = useSyncExternalStore(subscribe, () => `${version}:${readState()}`, () => "0:hidden").split(":")[1] as State;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!publicKey || state === "hidden") return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      // Storage blocked: hidden until the page reloads.
    }
    bump();
  };

  async function turnOn() {
    setBusy(true);
    setError(false);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return bump();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) }));
      const res = await fetch("/api/cabinet/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error();
      bump();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-2.5 border-b border-line bg-brand-soft px-3 py-2.5 text-[14px] sm:px-4">
      {state === "ios" ? <Share className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
      <p className="min-w-0 flex-1 leading-snug">
        {error ? t.fail : state === "ios" ? t.ios : state === "denied" ? t.denied : t.ask}
      </p>
      {state === "ask" && (
        <button type="button" onClick={() => void turnOn()} disabled={busy} className="btn-primary min-h-9 shrink-0 px-3 text-[13.5px] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t.on}
        </button>
      )}
      <button type="button" onClick={hide} aria-label={t.close} title={t.close} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

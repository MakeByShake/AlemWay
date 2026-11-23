"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Delete, Fingerprint, Loader2, Lock, ShieldCheck, X } from "lucide-react";

/**
 * Lock on a phone, like a banking app: after a few minutes in the background (or on a new start) the screen asks
 * for the fingerprint / face or a 4-digit PIN. A lock of this device only; the login stays the real protection.
 * Settings live in this phone's browser, per person (`owner`). Used by the admin (team) and the cabinet (clients).
 * Fingerprint: in the Android app through the phone itself (window.AlemWayBio, see mobile/ MainActivity),
 * in a browser through WebAuthn.
 */

export type LockText = {
  offerTitle: string;
  offerText: string;
  enable: string;
  notNow: string;
  setupTitle: string;
  repeatTitle: string;
  setupHint: string;
  mismatch: string;
  lockedTitle: string;
  enterPin: (name: string) => string;
  wrongPin: (left: number) => string;
  bioButton: string;
  bioPrompt: string;
  forgot: string;
  cancel: string;
  erase: string;
  turnOn: string;
  turnOff: string;
  isOn: string;
  isOff: string;
  confirmOff: string;
};

type LockSettings = { salt: string; pin: string; cred?: string; minutes: number };

const AWAY_KEY = "aw-lock-away";
const ASKED_KEY = "aw-lock-asked";
const MAX_TRIES = 5;

const keyOf = (login: string) => `aw-lock:${login}`;
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function load(login: string): LockSettings | null {
  try {
    const raw = localStorage.getItem(keyOf(login));
    return raw ? (JSON.parse(raw) as LockSettings) : null;
  } catch {
    return null;
  }
}
function save(login: string, s: LockSettings | null) {
  try {
    if (s) localStorage.setItem(keyOf(login), JSON.stringify(s));
    else localStorage.removeItem(keyOf(login));
  } catch {}
  emit();
}
function getFlag(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function setFlag(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest("SHA-256", data));
}

type NativeBio = { available(): boolean; authenticate(id: string, title: string): void };
const nativeBio = () => (typeof window === "undefined" ? undefined : (window as Window & { AlemWayBio?: NativeBio }).AlemWayBio);
const waiting = new Map<string, (ok: boolean) => void>();

/** The Android app asks the phone for the fingerprint; the answer comes back through window.__awBio. */
function askNative(title: string): Promise<boolean> {
  const bio = nativeBio();
  if (!bio) return Promise.resolve(false);
  (window as Window & { __awBio?: (id: string, ok: boolean) => void }).__awBio = (id, ok) => {
    waiting.get(id)?.(ok);
    waiting.delete(id);
  };
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    try {
      bio.authenticate(id, title);
    } catch {
      waiting.delete(id);
      resolve(false);
    }
  });
}

async function canUseWebBiometrics() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Registers the phone's fingerprint / face for this site; returns the credential id. */
async function createCredential(login: string, name: string): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "AlemWay", id: location.hostname },
        user: { id: new TextEncoder().encode(login).slice(0, 64), name: login, displayName: name },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    return cred ? b64(cred.rawId) : null;
  } catch {
    return null;
  }
}

async function checkCredential(id: string): Promise<boolean> {
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: unb64(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!got;
  } catch {
    return false;
  }
}

function PinPad({ value, onChange, disabled, erase }: { value: string; onChange: (v: string) => void; disabled?: boolean; erase: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-brand ${i < value.length ? "bg-brand" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k) =>
          k === "" ? (
            <span key="empty" />
          ) : (
            <button
              key={k}
              type="button"
              disabled={disabled}
              aria-label={k === "del" ? erase : k}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[24px] font-semibold shadow-sm active:bg-brand-soft disabled:opacity-50"
              onClick={() => onChange(k === "del" ? value.slice(0, -1) : (value + k).slice(0, 4))}
            >
              {k === "del" ? <Delete className="h-6 w-6" /> : k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// A tiny store over localStorage, so React reads the lock settings without effects.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
const rawOf = (login: string) => {
  try {
    return localStorage.getItem(keyOf(login));
  } catch {
    return null;
  }
};
/** Locked or not; decided once per page start from the last time the admin was in front of the user. */
let lockedNow: boolean | null = null;
function isLocked(login: string) {
  if (lockedNow === null) {
    const s = load(login);
    const away = Number(getFlag(AWAY_KEY) || 0);
    lockedNow = !!s && (!away || Date.now() - away > s.minutes * 60_000);
  }
  return lockedNow;
}
function setLockedNow(v: boolean) {
  lockedNow = v;
  emit();
}

export function AppLock({
  login,
  name,
  text: T,
  onLogout,
  offerHere,
  offerInline = false,
}: {
  login: string;
  name: string;
  text: LockText;
  onLogout: () => Promise<void>;
  offerHere: boolean;
  /** The offer as a card in the page (cabinet) instead of a floating banner (admin). */
  offerInline?: boolean;
}) {
  const raw = useSyncExternalStore(subscribe, () => rawOf(login), () => null);
  const settings = useMemo<LockSettings | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as LockSettings) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const locked = useSyncExternalStore(subscribe, () => isLocked(login), () => false);
  const offerable = useSyncExternalStore(
    subscribe,
    () => !raw && window.matchMedia("(pointer: coarse)").matches && !getFlag(`${ASKED_KEY}:${login}`),
    () => false
  );
  // The offer shows on one main page only, so it never covers the buttons of other pages.
  const offer = offerHere && offerable;
  const [setup, setSetup] = useState<null | { step: "pin" | "again"; first: string }>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);
  const askedBio = useRef(false);

  // «Включить блокировку» from the menu.
  useEffect(() => {
    const on = () => setSetup({ step: "pin", first: "" });
    window.addEventListener("aw-lock-setup", on);
    return () => window.removeEventListener("aw-lock-setup", on);
  }, []);

  // Going to the background remembers the time; coming back after too long locks.
  useEffect(() => {
    if (!settings) return;
    const mark = () => setFlag(AWAY_KEY, String(Date.now()));
    const onVis = () => {
      if (document.visibilityState === "hidden") return mark();
      const away = Number(getFlag(AWAY_KEY) || 0);
      if (away && Date.now() - away > settings.minutes * 60_000) setLockedNow(true);
      mark();
    };
    mark();
    const timer = setInterval(() => document.visibilityState === "visible" && mark(), 30_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", mark);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", mark);
    };
  }, [settings]);

  const unlock = useCallback(() => {
    setLockedNow(false);
    setPin("");
    setError("");
    setTries(0);
    askedBio.current = false;
    setFlag(AWAY_KEY, String(Date.now()));
  }, []);

  const tryBio = useCallback(async () => {
    if (!settings?.cred) return;
    setChecking(true);
    const ok = settings.cred === "native" ? await askNative(T.bioPrompt) : await checkCredential(settings.cred);
    setChecking(false);
    if (ok) unlock();
  }, [settings, unlock, T]);

  // The fingerprint prompt opens by itself once per lock.
  useEffect(() => {
    if (locked && settings?.cred && !askedBio.current && document.visibilityState === "visible") {
      askedBio.current = true;
      void tryBio();
    }
  }, [locked, settings, tryBio]);

  async function enterPin(v: string) {
    setPin(v);
    setError("");
    if (v.length < 4 || !settings) return;
    if ((await hashPin(v, settings.salt)) === settings.pin) return unlock();
    const left = MAX_TRIES - tries - 1;
    setTries((n) => n + 1);
    setPin("");
    if (left <= 0) {
      save(login, null);
      setLockedNow(false);
      await onLogout();
      return;
    }
    setError(T.wrongPin(left));
  }

  async function setupPin(v: string) {
    setPin(v);
    setError("");
    if (v.length < 4 || !setup) return;
    if (setup.step === "pin") {
      setSetup({ step: "again", first: v });
      setPin("");
      return;
    }
    if (v !== setup.first) {
      setSetup({ step: "pin", first: "" });
      setPin("");
      setError(T.mismatch);
      return;
    }
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const next: LockSettings = { salt, pin: await hashPin(v, salt), minutes: 5 };
    // Fingerprint: the phone asks once now, so the person sees it works.
    if (nativeBio()?.available()) next.cred = (await askNative(T.bioPrompt)) ? "native" : undefined;
    else if (await canUseWebBiometrics()) next.cred = (await createCredential(login, name)) ?? undefined;
    setFlag(AWAY_KEY, String(Date.now()));
    save(login, next);
    setSetup(null);
    setPin("");
  }

  function dismissOffer() {
    setFlag(`${ASKED_KEY}:${login}`, "1");
    emit();
  }

  if (setup) {
    return (
      <div role="dialog" aria-modal="true" aria-label={T.setupTitle} className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-surface px-6">
        <button type="button" aria-label={T.cancel} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full hover:bg-line/40" onClick={() => setSetup(null)}>
          <X className="h-5 w-5" />
        </button>
        <ShieldCheck className="h-10 w-10 text-brand" />
        <p className="text-center text-[18px] font-bold">{setup.step === "pin" ? T.setupTitle : T.repeatTitle}</p>
        <p className="max-w-xs text-center text-[14px] text-muted">{T.setupHint}</p>
        <PinPad value={pin} onChange={setupPin} erase={T.erase} />
        {error && <p className="text-[14px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (locked && settings) {
    return (
      <div role="dialog" aria-modal="true" aria-label={T.lockedTitle} className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-surface px-6">
        <Lock className="h-10 w-10 text-brand" />
        <div className="text-center">
          <p className="text-[18px] font-bold">{T.lockedTitle}</p>
          <p className="mt-1 text-[14px] text-muted">{T.enterPin(name)}</p>
        </div>
        <PinPad value={pin} onChange={enterPin} disabled={checking} erase={T.erase} />
        {error && <p className="text-[14px] text-red-600">{error}</p>}
        {settings.cred && (
          <button type="button" className="btn-ghost min-h-12 px-5 text-[15px]" disabled={checking} onClick={tryBio}>
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />} {T.bioButton}
          </button>
        )}
        <button
          type="button"
          className="min-h-11 text-[14px] font-medium text-muted hover:text-ink"
          onClick={async () => {
            save(login, null);
            setLockedNow(false);
            await onLogout();
          }}
        >
          {T.forgot}
        </button>
      </div>
    );
  }

  if (offer) {
    return (
      <div
        className={
          offerInline
            ? "mt-6 flex items-start gap-3 rounded-2xl border border-line bg-white p-4"
            : "fixed inset-x-3 top-3 z-40 flex items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg sm:left-auto sm:max-w-sm"
        }
      >
        <Fingerprint className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
        <div className="flex-1">
          <p className="text-[15px] font-semibold">{T.offerTitle}</p>
          <p className="mt-0.5 text-[13px] text-muted">{T.offerText}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary min-h-10 px-4 text-[14px]"
              onClick={() => {
                dismissOffer();
                setSetup({ step: "pin", first: "" });
              }}
            >
              {T.enable}
            </button>
            <button type="button" className="btn-ghost min-h-10 px-4 text-[14px]" onClick={dismissOffer}>
              {T.notNow}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Lock switch: turn on (PIN + fingerprint) or off on this phone. */
export function LockToggle({ login, compact, text: T }: { login: string; compact?: boolean; text: LockText }) {
  const on = useSyncExternalStore(subscribe, () => rawOf(login) !== null, () => null);
  if (on === null) return null;
  return (
    <button
      type="button"
      className={compact ? "flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface" : "font-medium text-brand hover:underline"}
      aria-label={compact ? (on ? T.turnOff : T.turnOn) : undefined}
      aria-pressed={compact ? on : undefined}
      title={compact ? (on ? T.isOn : T.isOff) : undefined}
      onClick={() => {
        if (on && compact && !window.confirm(T.confirmOff)) return;
        if (on) {
          save(login, null);
        } else {
          window.dispatchEvent(new Event("aw-lock-setup"));
        }
      }}
    >
      {compact ? <Lock className={`h-[18px] w-[18px] ${on ? "text-brand" : ""}`} /> : on ? T.turnOff : T.turnOn}
    </button>
  );
}

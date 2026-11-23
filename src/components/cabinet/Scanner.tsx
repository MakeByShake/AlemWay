"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Plus, RotateCw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { pagesToPdf, previewOf, type ScanPage } from "@/lib/scan";

/** The Android app's own scanner (Google document scanner: finds the sheet, crops and straightens it). */
type NativeScan = { available(): boolean; start(id: string): void };
type NativeResult = { pdf?: string; pages?: string[] } | null;
const nativeScan = () => (typeof window === "undefined" ? undefined : (window as Window & { AlemWayScan?: NativeScan }).AlemWayScan);

function scanInApp(): Promise<{ result: NativeResult; state: string }> {
  const scan = nativeScan();
  if (!scan) return Promise.resolve({ result: null, state: "error" });
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    (window as Window & { __awScan?: (id: string, result: NativeResult, state: string) => void }).__awScan = (got, result, state) => {
      if (got === id) resolve({ result, state });
    };
    try {
      scan.start(id);
    } catch {
      resolve({ result: null, state: "error" });
    }
  });
}

const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export type ScannerText = {
  scanTitle: string;
  scanHint: string;
  scanShoot: string;
  scanMore: string;
  scanBw: string;
  scanRotate: string;
  scanRemove: string;
  scanPage: string;
  scanDone: string;
  scanCancel: string;
  scanMaking: string;
  scanFailed: string;
};

/**
 * Full-screen sheet: photograph pages one by one with the back camera, fix each page (turn, black-and-white),
 * then hand one PDF to `onDone`. The camera opens through a normal file input with `capture`, which works in
 * Safari, Chrome, the installed site and the Android app.
 */
export function Scanner({ t, name, onDone, onClose }: { t: ScannerText; name: string; onDone: (f: File) => void; onClose: () => void }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState<"page" | "pdf" | null>(null);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  // In the Android app the phone's document scanner opens right away; if it can't, the page scanner below is used.
  const [inApp, setInApp] = useState(() => Boolean(nativeScan()?.available()));
  const started = useRef(false);

  useEffect(() => {
    if (!inApp || started.current) return;
    started.current = true;
    void (async () => {
      const { result, state } = await scanInApp();
      if (state === "cancel") return onClose();
      try {
        if (state !== "ok" || !result) throw new Error(state);
        let file: File;
        if (result.pdf) {
          file = new File([bytesOf(result.pdf)], `${name}.pdf`, { type: "application/pdf" });
        } else {
          const pages: ScanPage[] = (result.pages ?? []).map((b64, i) => ({ id: String(i), source: new File([bytesOf(b64)], `${i}.jpg`, { type: "image/jpeg" }), rotate: 0, bw: false, preview: "" }));
          if (!pages.length) throw new Error("empty");
          setBusy("pdf");
          file = await pagesToPdf(pages, name);
        }
        onDone(file);
        onClose();
      } catch (err) {
        console.error("[scan] app scanner failed", err);
        setBusy(null);
        setInApp(false);
      }
    })();
  }, [inApp, name, onDone, onClose]);

  useEffect(() => {
    const all = urls.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      for (const u of all) URL.revokeObjectURL(u);
    };
  }, [onClose]);

  async function withPreview(page: ScanPage): Promise<ScanPage> {
    const preview = await previewOf(page);
    urls.current.add(preview);
    return { ...page, preview };
  }

  async function addPhotos(files: File[]) {
    setBusy("page");
    setError(false);
    try {
      const added: ScanPage[] = [];
      for (const source of files) {
        added.push(await withPreview({ id: crypto.randomUUID(), source, rotate: 0, bw: false, preview: "" }));
      }
      setPages((p) => [...p, ...added]);
    } catch (err) {
      console.error("[scan] page failed", err);
      setError(true);
    }
    setBusy(null);
  }

  async function change(id: string, edit: (p: ScanPage) => ScanPage) {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    setBusy("page");
    try {
      const next = await withPreview(edit(page));
      setPages((list) => list.map((p) => (p.id === id ? next : p)));
    } catch (err) {
      console.error("[scan] edit failed", err);
      setError(true);
    }
    setBusy(null);
  }

  async function finish() {
    setBusy("pdf");
    setError(false);
    try {
      const file = await pagesToPdf(pages, name);
      onDone(file);
      onClose();
    } catch (err) {
      console.error("[scan] pdf failed", err);
      setError(true);
      setBusy(null);
    }
  }

  if (inApp) {
    return (
      <div role="dialog" aria-modal="true" aria-label={t.scanTitle} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-[15px] text-muted">{busy === "pdf" ? t.scanMaking : t.scanTitle}</p>
        <button type="button" className="btn-ghost min-h-11 px-4 text-[14px]" onClick={onClose}>
          {t.scanCancel}
        </button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.scanTitle} className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 text-[17px] font-bold">{t.scanTitle}</p>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-line/40" aria-label={t.scanCancel} onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {pages.length === 0 && <p className="mx-auto max-w-md text-center text-[14px] leading-snug text-muted">{t.scanHint}</p>}
        <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
          {pages.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={p.preview} alt={`${t.scanPage} ${i + 1}`} className="aspect-[3/4] w-full rounded-lg bg-line/30 object-contain" />
              <p className="text-center text-[13px] font-semibold">
                {t.scanPage} {i + 1}
              </p>
              <div className="flex items-center justify-between gap-1">
                <button type="button" disabled={!!busy} aria-label={t.scanRotate} title={t.scanRotate} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-line/40" onClick={() => change(p.id, (x) => ({ ...x, rotate: ((x.rotate + 90) % 360) as ScanPage["rotate"] }))}>
                  <RotateCw className="h-4 w-4" />
                </button>
                <button type="button" disabled={!!busy} aria-pressed={p.bw} className={clsx("h-10 flex-1 rounded-lg px-2 text-[12px] font-semibold", p.bw ? "bg-ink text-white" : "hover:bg-line/40")} onClick={() => change(p.id, (x) => ({ ...x, bw: !x.bw }))}>
                  {t.scanBw}
                </button>
                <button type="button" disabled={!!busy} aria-label={t.scanRemove} title={t.scanRemove} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" onClick={() => setPages((list) => list.filter((x) => x.id !== p.id))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {error && <p className="mt-4 text-center text-[14px] text-red-600">{t.scanFailed}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void addPhotos(files);
        }}
      />
      <div className="flex flex-col gap-2 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end">
        <button type="button" className={clsx("min-h-12 px-5 text-[15px]", pages.length ? "btn-ghost" : "btn-primary")} disabled={!!busy} onClick={() => input.current?.click()}>
          {busy === "page" ? <Loader2 className="h-5 w-5 animate-spin" /> : pages.length ? <Plus className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          {pages.length ? t.scanMore : t.scanShoot}
        </button>
        {pages.length > 0 && (
          <button type="button" className="btn-primary min-h-12 px-5 text-[15px]" disabled={!!busy} onClick={finish}>
            {busy === "pdf" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> {t.scanMaking}
              </>
            ) : (
              t.scanDone
            )}
          </button>
        )}
      </div>
    </div>
  );
}

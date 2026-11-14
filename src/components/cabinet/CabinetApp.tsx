"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileUp,
  Hourglass,
  Loader2,
  LogOut,
  MapPin,
  PartyPopper,
} from "lucide-react";
import clsx from "clsx";
import {
  FIELD_ERROR_TEXT,
  SERVICE_FILES,
  SERVICE_TITLES,
  ketaNotices,
  sectionsFor,
  type ServiceId,
  MAX_UPLOAD_BYTES,
  toGermanDate,
  validateCabinetData,
  NO_PASSPORT_REQUIRED,
  type CabinetData,
  type CabinetField,
  type CabinetStatus,
  type FieldError,
  type FileKind,
  type UploadKind,
  FILE_LABELS,
} from "@/lib/cabinet/fields";
import { CABINET_TEXT, type CabinetLocale } from "@/lib/cabinet/i18n";
import { Pipeline } from "@/components/Pipeline";
import { compressForUpload } from "@/lib/compress-file";

type FileMeta = { name: string; size: number; uploadedAt: string } | null;

export type CabinetView = {
  service: ServiceId;
  ketaValidUntil: string | null;
  /** Today in Almaty (YYYY-MM-DD), for the K-ETA timing notice. */
  today: string;
  name: string;
  status: CabinetStatus;
  data: CabinetData;
  files: Record<FileKind, FileMeta>;
  declarationDate: string | null;
  /** Old client moved to the new form 06/2026: fills the questionnaire again. */
  reform: boolean;
  /** Open «деканат не ставит печать» report, if any. */
  deanIssue: DeanIssueView | null;
  /** Last AI check, when it said what is missing. */
  ai: { status: string; missing: string[]; clientMessage: string } | null;
  job: { employer: string | null; city: string | null; position: string | null; from: string | null; to: string | null; message: string | null };
};


export function CabinetApp({ view, locale }: { view: CabinetView; locale: CabinetLocale }) {
  const t = CABINET_TEXT[locale];
  const router = useRouter();
  const formId = useId();
  const keta = view.service === "keta";
  const sections = sectionsFor(view.service);
  // Once the declaration is made, the questionnaire is closed: the client only signs and sends it.
  const editable = view.status === "waiting_data";

  const [data, setData] = useState<CabinetData>(() => {
    const d: CabinetData = { ...view.data };
    for (const s of sections) for (const f of s.fields) if (!d[f.key] && f.defaultValue) d[f.key] = f.defaultValue;
    return d;
  });
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [busy, setBusy] = useState<null | "save" | "submit" | "submitSigned" | UploadKind>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [files, setFiles] = useState(view.files);
  const [ai, setAi] = useState(view.ai);

  const set = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    if (editable) setSaveState("pending");
    if (errors[key]) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
  };

  async function post(submit: boolean) {
    const res = await fetch("/api/cabinet/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, submit }),
    });
    return {
      res,
      json: (await res.json().catch(() => ({}))) as {
        errors?: Record<string, FieldError>;
        missingFiles?: string[];
        error?: string;
        ai?: { missing: string[]; clientMessage: string };
      },
    };
  }

  // Autosave: every change is saved ~0.7 s after the client stops typing.
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "err">("idle");
  const [savedTick, setSavedTick] = useState(0);
  const lastSaved = useRef(JSON.stringify(data));
  const saveSeq = useRef(0);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  async function autosave() {
    const body = JSON.stringify(dataRef.current);
    if (body === lastSaved.current) return setSaveState((s) => (s === "pending" ? "saved" : s));
    const seq = ++saveSeq.current;
    setSaveState("saving");
    try {
      const res = await fetch("/api/cabinet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataRef.current, submit: false }),
      });
      if (seq !== saveSeq.current) return; // a newer save is in flight
      if (res.ok) {
        lastSaved.current = body;
        setSaveState("saved");
        setSavedTick((n) => n + 1);
      } else setSaveState("err");
    } catch {
      if (seq === saveSeq.current) setSaveState("err");
    }
  }

  useEffect(() => {
    if (!editable || JSON.stringify(data) === lastSaved.current) return;
    const id = setTimeout(autosave, 700);
    return () => clearTimeout(id);
  }, [data, editable]);

  // Closing the tab mid-typing: send what is left.
  useEffect(() => {
    const flush = () => {
      const body = JSON.stringify(dataRef.current);
      if (!editable || body === lastSaved.current) return;
      fetch("/api/cabinet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataRef.current, submit: false }),
        keepalive: true,
      }).catch(() => null);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [editable]);

  /**
   * The AI takes up to 1–2 minutes; on a phone the connection can drop meanwhile while the server keeps working.
   * Then we wait for the result instead of showing an error.
   */
  async function waitForAi(startedAt: string) {
    setNotice({ tone: "ok", text: t.aiStillWorking });
    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const j = (await fetch("/api/cabinet/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as { status?: string; ai?: { status: string; missing: string[]; clientMessage: string; checkedAt?: string } | null } | null;
      if (!j) continue;
      if (j.status && j.status !== "waiting_data") {
        setNotice(null);
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (j.ai?.checkedAt && j.ai.checkedAt >= startedAt) {
        setNotice(null);
        setAi(j.ai);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    setNotice({ tone: "err", text: t.aiFailed });
  }

  async function onSubmit() {
    setNotice(null);
    const errs = validateCabinetData(data, view.service);
    if (!keta && !files.passport) for (const k of NO_PASSPORT_REQUIRED) if (!data[k]?.trim() && !errs[k]) errs[k] = "required";
    const missing = SERVICE_FILES[view.service].requiredBeforeSubmit.some((k) => !files[k]);
    setErrors(errs);
    if (Object.keys(errs).length || missing) {
      setNotice({ tone: "err", text: Object.keys(errs).length ? t.fixErrors : t.needFiles });
      const first = Object.keys(errs)[0];
      if (first) document.getElementById(`${formId}-${first}`)?.focus();
      if (Object.keys(errs).length) await post(false).catch(() => null); // keep what was typed
      return;
    }
    setBusy("submit");
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    try {
      const { res, json } = await post(true);
      if (res.ok) {
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (json.error === "not_ready" && json.ai) {
        setAi({ status: "НЕ ГОТОВО", ...json.ai });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.status === 422) {
        setErrors(json.errors ?? {});
        setNotice({ tone: "err", text: json.missingFiles?.length ? t.needFiles : t.fixErrors });
      } else if (json.error === "ai_failed") setNotice({ tone: "err", text: t.aiFailed });
      // Gateway timeout and the like: the server may still be finishing the declaration.
      else if (res.status >= 500) await waitForAi(startedAt);
      else setNotice({ tone: "err", text: t.errorGeneric });
    } catch {
      // Connection dropped (phone, 4G): the AI keeps working on the server.
      await waitForAi(startedAt);
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: UploadKind, picked: File) {
    setNotice(null);
    setBusy(kind);
    const file = await compressForUpload(picked);
    if (file.size > MAX_UPLOAD_BYTES) return setNotice({ tone: "err", text: t.errTooLarge });
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/cabinet/upload?kind=${kind}`, { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { file?: FileMeta; error?: string };
      if (res.ok && json.file) {
        setFiles((f) => ({ ...f, [kind]: json.file! }));
        if (kind === "signed" || kind === "signed2") router.refresh();
      } else {
        setNotice({
          tone: "err",
          text: json.error === "too_large" ? t.errTooLarge : json.error === "bad_type" ? t.errType : t.errorGeneric,
        });
      }
    } catch {
      setNotice({ tone: "err", text: t.errorGeneric });
    } finally {
      setBusy(null);
    }
  }

  async function submitSigned() {
    setNotice(null);
    setBusy("submitSigned");
    try {
      const res = await fetch("/api/cabinet/submit-signed", { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setNotice({ tone: "err", text: t.errorGeneric });
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/cabinet/logout", { method: "POST" }).catch(() => null);
    router.refresh();
  }

  return (
    <section className="container-x py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{SERVICE_TITLES[view.service][locale]}</p>
            <h1 className="h-section mt-2">
              {t.hello}, {view.name}
            </h1>
          </div>
          <button type="button" onClick={logout} aria-label={t.logout} className="btn-ghost min-h-10 shrink-0 px-3 text-[14px]">
            <LogOut className="h-4 w-4" /> <span className="hidden min-[360px]:inline">{t.logout}</span>
          </button>
        </div>

        <div className="mt-8" aria-label={t.title}>
          <Pipeline service={view.service} status={view.status} locale={locale} />
        </div>

        {notice && (
          <div
            role={notice.tone === "err" ? "alert" : "status"}
            className={clsx(
              "mt-6 flex items-start gap-2 rounded-xl px-4 py-3 text-[15px]",
              notice.tone === "err" ? "bg-warn-soft text-warn" : "bg-accent-soft text-ink"
            )}
          >
            {notice.tone === "err" ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />}
            {notice.text}
          </div>
        )}

        {view.reform && view.status === "waiting_data" && <Banner tone="warn" title={t.reformTitle} text={t.reformText} />}
        {view.status === "done" && !keta && <Banner title={t.doneTitle} text={t.doneText} />}
        {view.status === "keta_applying" && <Banner tone="wait" title={t.ketaApplyingTitle} text={t.ketaApplyingText} />}
        {view.status === "keta_applied" && <Banner tone="wait" title={t.ketaAppliedTitle} text={t.ketaAppliedText} />}
        {view.status === "keta_rejected" && <Banner tone="warn" title={t.ketaRejectedTitle} text={view.job.message || t.ketaRejectedText} />}
        {keta && (view.status === "keta_approved" || view.status === "done") && <KetaCard view={view} t={t} hasFile={Boolean(files.keta)} />}
        {!keta && (view.status === "signed_uploaded" || view.status === "sent_partner") && (
          <div className="card mt-6 border-accent/40 bg-accent-soft p-6 text-center sm:p-10">
            <p className="text-[56px] leading-none" aria-hidden>
              🎉
            </p>
            <h2 className="mt-4 text-[24px] font-bold sm:text-[28px]">{t.zavWaitTitle.replace(/^🎉\s*/, "")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-muted">{t.zavWaitText}</p>
          </div>
        )}
        {!keta && ["zav_received", "visa_applying", "visa_received", "done"].includes(view.status) && <ZavCard view={view} t={t} hasFile={Boolean(files.zav)} />}

        {files.declaration && (
          <div className="card mt-6 p-5 sm:p-7">
            <h2 className="h-card">{t.declTitle}</h2>
            {view.status === "declaration_ready" && (
              <>
                <p className="mt-3 text-[15px] text-muted">{t.declText}</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed">
                  {t.declSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            )}
            {ai?.status === "ГОТОВО БЕЗ ПАСПОРТА" && ai.missing.length > 0 && (
              <div className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-[15px] text-warn">
                <ul className="list-disc space-y-1 pl-5">
                  {ai.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {view.declarationDate && (
              <p className="mt-3 text-[14px] text-muted">
                {t.declDate}: {toGermanDate(view.declarationDate)}
              </p>
            )}
            <a href="/api/cabinet/file/declaration" download className={clsx("mt-5", view.status === "declaration_ready" ? "btn-primary" : "btn-ghost")}>
              <Download className="h-4 w-4" /> {t.download}
            </a>

            {view.status === "declaration_ready" && (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-3 text-[15px] font-semibold">{t.signedTitle}</p>
                <div className="grid gap-4">
                  {(["signed", "signed2"] as const).map((k, i) => (
                    <FileRow
                      key={k}
                      label={t.signedCopy[i]!}
                      meta={files[k]}
                      busy={busy === k}
                      t={t}
                      buttonText={files[k] ? t.replace : t.signedUpload}
                      onPick={(f) => upload(k, f)}
                    />
                  ))}
                </div>
                {files.signed && !files.signed2 && <p className="mt-3 text-[14px] text-muted">{t.signedNeedSecond}</p>}
                {files.signed && files.signed2 && (
                  <div className="mt-4 rounded-xl bg-brand-soft p-4">
                    <p className="text-[15px]">{t.submitSignedHint}</p>
                    <button type="button" onClick={submitSigned} disabled={busy !== null} className="btn-primary mt-3 w-full sm:w-auto">
                      {busy === "submitSigned" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> {t.submittingSigned}
                        </>
                      ) : (
                        t.submitSigned
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            {view.status === "declaration_ready" && <DeanIssueBox t={t} initial={view.deanIssue} uniName={view.data.uniName} />}
            {view.status === "declaration_ready" && !files.passport && (
              <div className="mt-6 border-t border-line pt-5">
                <FileRow
                  label={FILE_LABELS.passport[locale]}
                  hint={t.passportLater}
                  meta={files.passport}
                  busy={busy === "passport"}
                  t={t}
                  buttonText={t.upload}
                  onPick={(f) => upload("passport", f)}
                />
              </div>
            )}
          </div>
        )}

        {editable && (
          <form
            className="mt-6 space-y-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {!keta && ai?.status === "НЕ ГОТОВО" && (
              <div role="alert" className="card border-warn/40 bg-warn-soft p-5 sm:p-7">
                <h2 className="h-card flex items-center gap-2 text-warn">
                  <AlertCircle className="h-5 w-5 shrink-0" /> {t.aiNotReadyTitle}
                </h2>
                <p className="mt-2 text-[15px]">{t.aiNotReadyText}</p>
                {ai.missing.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                    {ai.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
                {ai.clientMessage && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-muted">{ai.clientMessage}</p>}
              </div>
            )}

            {!files.declaration && (
              <div className="card p-5 sm:p-7">
                <h2 className="h-card">{keta ? t.ketaIntroTitle : t.introTitle}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{keta ? t.ketaIntroText : t.introText}</p>
              </div>
            )}

            {sections.filter((section) => !(section.id === "nopassport" && files.passport)).map((section) => (
              <fieldset key={section.id} className="card p-5 sm:p-7">
                <legend className="sr-only">{section.title[locale]}</legend>
                <h2 className="h-card" aria-hidden="true">
                  {section.title[locale]}
                </h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {section.fields.map((f) => (
                    <Field
                      key={f.key}
                      f={f}
                      id={`${formId}-${f.key}`}
                      value={data[f.key] ?? ""}
                      error={errors[f.key]}
                      locale={locale}
                      t={t}
                      onChange={(v) => set(f.key, v)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="card p-5 sm:p-7">
              <h2 className="h-card">{t.documents}</h2>
              <p className="mt-2 text-[14px] text-muted">{keta ? t.ketaDocsHint : t.documentsHint}</p>
              <div className="mt-5 space-y-4">
                {SERVICE_FILES[view.service].form.map((kind) => (
                  <FileRow
                    key={kind}
                    label={
                      FILE_LABELS[kind][locale].replace(/ \((необязательно|міндетті емес)\)$/, "") +
                      (SERVICE_FILES[view.service].requiredBeforeSubmit.includes(kind)
                        ? keta
                          ? ""
                          : ` (${t.required})`
                        : ` (${kind === "passport" && !keta ? t.passportSuffix : t.optional})`)
                    }
                    hint={kind === "photo" ? t.ketaPhotoHint : kind === "calendar" ? t.calendarHint : kind === "license" ? t.licenseHint : kind === "passport" && !keta ? t.passportLater : undefined}
                    meta={files[kind]}
                    busy={busy === kind}
                    t={t}
                    buttonText={files[kind] ? t.replace : t.upload}
                    onPick={(f) => upload(kind, f)}
                  />
                ))}
              </div>
            </div>

            {keta &&
              ketaNotices(data, view.today).map((n) => (
                <div key={n} role="note" className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-[15px] text-warn">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  {n === "ageExempt" ? t.noticeAgeExempt : t.noticeTooSoon}
                </div>
              ))}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="btn-primary sm:flex-1" disabled={busy !== null}>
                {busy === "submit" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.submitting}
                  </>
                ) : keta ? (
                  t.ketaSubmit
                ) : ai?.status === "НЕ ГОТОВО" ? (
                  t.resubmit
                ) : (
                  t.submit
                )}
              </button>
              <SaveStatus state={saveState} tick={savedTick} t={t} onRetry={autosave} />
            </div>
          </form>
        )}
        {editable && <SaveToast state={saveState} tick={savedTick} t={t} />}
      </div>
    </section>
  );
}

type T = (typeof CABINET_TEXT)[CabinetLocale];
type DeanIssueView = { uni: string; faculty: string; group: string; reason: string; phone: string };

/** «Деканат не ставит подпись и печать?» — the client tells where and why; the team gets it in Telegram. */
function DeanIssueBox({ t, initial, uniName }: { t: T; initial: DeanIssueView | null; uniName?: string }) {
  const [sent, setSent] = useState<DeanIssueView | null>(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DeanIssueView>(initial ?? { uni: uniName ?? "", faculty: "", group: "", reason: "", phone: "" });
  const set = (k: keyof DeanIssueView) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (sent && !editing)
    return (
      <div className="mt-6 rounded-xl bg-warn-soft p-4 text-[15px]">
        <p className="font-semibold">{t.deanSentTitle}</p>
        <p className="mt-1 text-muted">{t.deanSentText}</p>
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-[14px] font-semibold text-brand hover:underline">
          {t.deanEdit}
        </button>
      </div>
    );

  return (
    <details className="mt-6 rounded-xl border border-line p-4" open={editing}>
      <summary className="cursor-pointer text-[15px] font-semibold text-warn">{t.deanTitle}</summary>
      <p className="mt-2 text-[14px] text-muted">{t.deanHint}</p>
      <form
        className="mt-3 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/cabinet/dean-issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!res.ok) throw new Error();
            setSent(form);
            setEditing(false);
          } catch {
            setError(t.errorGeneric);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1 text-[14px] font-medium">
          {t.deanUni}
          <input required value={form.uni} onChange={set("uni")} className="field" maxLength={200} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[14px] font-medium">
            {t.deanFaculty}
            <input required value={form.faculty} onChange={set("faculty")} className="field" maxLength={200} />
          </label>
          <label className="grid gap-1 text-[14px] font-medium">
            {t.deanGroup}
            <input required value={form.group} onChange={set("group")} className="field" maxLength={60} />
          </label>
        </div>
        <label className="grid gap-1 text-[14px] font-medium">
          {t.deanReason}
          <textarea required value={form.reason} onChange={set("reason")} rows={3} className="field" maxLength={1500} placeholder={t.deanReasonPh} />
        </label>
        <label className="grid gap-1 text-[14px] font-medium">
          {t.deanPhone}
          <input value={form.phone} onChange={set("phone")} inputMode="tel" className="field" maxLength={60} placeholder="+7 727 …" />
        </label>
        {error && <p className="text-[14px] text-warn">{error}</p>}
        <div>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t.deanSend}
          </button>
        </div>
      </form>
    </details>
  );
}
type SaveState = "idle" | "pending" | "saving" | "saved" | "err";

/** Inline status next to the submit button: replaces the old «Сохранить» button. */
function SaveStatus({ state, tick, t, onRetry }: { state: SaveState; tick: number; t: T; onRetry: () => void }) {
  if (state === "err")
    return (
      <button type="button" onClick={onRetry} className="btn-ghost text-warn">
        <AlertCircle className="h-4 w-4" /> {t.saveFailed}
      </button>
    );
  return (
    <p className="flex min-h-12 items-center justify-center gap-2 px-2 text-[14px] text-muted" aria-live="polite">
      {state === "pending" || state === "saving" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {t.saving}
        </>
      ) : state === "saved" ? (
        <span key={tick} className="saved-pop flex items-center gap-1.5 font-medium text-accent">
          <CheckCircle2 className="h-4 w-4" /> {t.saved}
        </span>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4" /> {t.autosaveHint}
        </>
      )}
    </p>
  );
}

/** Small «✓ Сохранено» chip that pops up at the bottom of the screen after each save. */
function SaveToast({ state, tick, t }: { state: SaveState; tick: number; t: T }) {
  if (state !== "saved" || tick === 0) return null;
  return (
    <div
      key={tick}
      aria-hidden
      className="saved-toast pointer-events-none fixed bottom-5 left-1/2 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-white shadow-lg"
    >
      <CheckCircle2 className="h-4 w-4" /> {t.saved}
    </div>
  );
}

function Banner({ title, text, tone = "ok" }: { title: string; text: string; tone?: "ok" | "wait" | "warn" }) {
  return (
    <div className={clsx("mt-6 flex items-start gap-3 rounded-2xl p-5", tone === "wait" ? "bg-brand-soft" : tone === "warn" ? "bg-warn-soft" : "bg-accent-soft")}>
      {tone === "wait" ? (
        <Hourglass className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
      ) : tone === "warn" ? (
        <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-warn" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
      )}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}

/** «K-ETA одобрен»: validity, the approval file, manager's note and the official rules for the trip. */
function KetaCard({ view, t, hasFile }: { view: CabinetView; t: T; hasFile: boolean }) {
  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-start gap-3 bg-accent-soft p-5 sm:p-7">
        <PartyPopper className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
        <div>
          <h2 className="h-card">{t.ketaApprovedTitle}</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{t.ketaApprovedText}</p>
          {view.ketaValidUntil && (
            <p className="mt-2 text-[15px] font-semibold">
              {t.ketaValidUntil}: {toGermanDate(view.ketaValidUntil)}
            </p>
          )}
        </div>
      </div>
      <div className="p-5 sm:p-7">
        {hasFile && (
          <a href="/api/cabinet/file/keta" download className="btn-primary">
            <Download className="h-4 w-4" /> {t.ketaDownload}
          </a>
        )}
        {view.job.message && (
          <div className={clsx("rounded-xl bg-surface p-4", hasFile && "mt-5")}>
            <p className="text-[13px] font-semibold text-muted">{t.ketaMessage}</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{view.job.message}</p>
          </div>
        )}
        <h3 className={clsx("text-[15px] font-semibold", (hasFile || view.job.message) && "mt-6")}>{t.ketaRulesTitle}</h3>
        <ul className="mt-2 space-y-2">
          {t.ketaRules.map((r) => (
            <li key={r} className="flex gap-2.5 text-[15px] leading-relaxed text-ink/85">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** «ZAV получен»: the job is confirmed — employer, dates, the manager's next steps and the ZAV file. */
function ZavCard({ view, t, hasFile }: { view: CabinetView; t: T; hasFile: boolean }) {
  const { job } = view;
  const dates = job.from && job.to ? `${toGermanDate(job.from)} — ${toGermanDate(job.to)}` : job.from ? `${t.zavFrom} ${toGermanDate(job.from)}` : null;
  const rows = [
    job.employer && { label: t.zavEmployer, value: job.employer, icon: Building2 },
    job.position && { label: t.zavPosition, value: job.position, icon: Briefcase },
    job.city && { label: t.zavCity, value: job.city, icon: MapPin },
    dates && { label: t.zavDates, value: dates, icon: CalendarDays },
  ].filter(Boolean) as { label: string; value: string; icon: typeof Building2 }[];

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-start gap-3 bg-accent-soft p-5 sm:p-7">
        <PartyPopper className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
        <div>
          <h2 className="h-card">{t.zavTitle}</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{t.zavText}</p>
        </div>
      </div>
      <div className="p-5 sm:p-7">
        {rows.length > 0 && (
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3">
                <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                <div>
                  <dt className="text-[13px] text-muted">{r.label}</dt>
                  <dd className="mt-0.5 text-[16px] font-semibold">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
        {job.message && (
          <div className={clsx("rounded-xl bg-surface p-4", rows.length > 0 && "mt-5")}>
            <p className="text-[13px] font-semibold text-muted">{t.zavMessage}</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{job.message}</p>
          </div>
        )}
        {hasFile && (
          <a href="/api/cabinet/file/zav" download className={clsx("btn-primary", (rows.length > 0 || job.message) && "mt-5")}>
            <Download className="h-4 w-4" /> {t.zavDownload}
          </a>
        )}
      </div>
    </div>
  );
}

function Field({
  f,
  id,
  value,
  error,
  locale,
  t,
  onChange,
}: {
  f: CabinetField;
  id: string;
  value: string;
  error?: FieldError;
  locale: CabinetLocale;
  t: T;
  onChange: (v: string) => void;
}) {
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : "", f.hint ? hintId : ""].filter(Boolean).join(" ") || undefined;
  const wide = f.key === "uniName" || f.key === "subject" || f.kind === "yesno";

  return (
    <div className={clsx(wide && "sm:col-span-2")}>
      {f.kind === "yesno" ? (
        <fieldset aria-describedby={describedBy}>
          <legend className="mb-2 block text-[14px] font-semibold">{f.label[locale]}</legend>
          <div className="flex gap-6">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-[15px]">
                <input
                  type="radio"
                  name={f.key}
                  id={v === "yes" ? id : undefined}
                  value={v}
                  checked={value === v}
                  onChange={() => onChange(v)}
                  className="h-5 w-5 accent-[var(--color-brand)]"
                />
                {v === "yes" ? t.yes : t.no}
              </label>
            ))}
          </div>
        </fieldset>
      ) : f.kind === "select" ? (
        <>
          <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">
            {f.label[locale]}
          </label>
          <select
            id={id}
            name={f.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="field"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          >
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label[locale]}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">
            {f.label[locale]} {f.optional && <span className="font-normal text-muted">({f.optionalNote?.[locale] ?? t.optional})</span>}
          </label>
          <input
            id={id}
            name={f.key}
            type={f.kind === "date" ? "date" : f.kind === "email" ? "email" : f.kind === "tel" ? "tel" : f.kind === "url" ? "url" : "text"}
            inputMode={f.kind === "number" ? "numeric" : undefined}
            autoComplete={f.key === "firstName" ? "given-name" : f.key === "lastName" ? "family-name" : f.key === "birthDate" ? "bday" : f.key === "phone" ? "tel" : "off"}
            lang={f.latin ? "en" : undefined}
            maxLength={f.maxLength}
            placeholder={f.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="field"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        </>
      )}
      {f.hint && (
        <p id={hintId} className="mt-1.5 text-[13px] text-muted">
          {f.hint[locale]}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 text-[13px] font-medium text-[#c0362c]">
          {FIELD_ERROR_TEXT[error][locale]}
        </p>
      )}
    </div>
  );
}

function FileRow({
  label,
  hint,
  meta,
  busy,
  t,
  buttonText,
  onPick,
}: {
  label: string;
  hint?: string;
  meta: FileMeta;
  busy: boolean;
  t: T;
  buttonText: string;
  onPick: (f: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-[15px] font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</p>}
        <p className={clsx("mt-0.5 flex items-center gap-1.5 text-[13px]", meta ? "text-accent" : "text-muted")}>
          {meta ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> {t.uploaded} · {Math.max(1, Math.round(meta.size / 1024))} КБ
            </>
          ) : (
            t.notUploaded
          )}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      <button type="button" className="btn-ghost min-h-11 px-4 text-[14px]" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.uploading}
          </>
        ) : (
          <>
            <FileUp className="h-4 w-4" /> {buttonText}
          </>
        )}
      </button>
    </div>
  );
}

"use client";

import { useId, useRef, useState } from "react";
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
  CABINET_SECTIONS,
  FIELD_ERROR_TEXT,
  MAX_UPLOAD_BYTES,
  toGermanDate,
  validateCabinetData,
  type CabinetData,
  type CabinetField,
  type CabinetStatus,
  type FieldError,
  type FileKind,
  type UploadKind,
  FILE_LABELS,
} from "@/lib/cabinet/fields";
import { CABINET_TEXT, type CabinetLocale } from "@/lib/cabinet/i18n";

type FileMeta = { name: string; size: number; uploadedAt: string } | null;

export type CabinetView = {
  name: string;
  status: CabinetStatus;
  data: CabinetData;
  files: Record<FileKind, FileMeta>;
  declarationDate: string | null;
  job: { employer: string | null; city: string | null; position: string | null; from: string | null; to: string | null; message: string | null };
};

const STEP_OF: Record<CabinetStatus, number> = { waiting_data: 0, declaration_ready: 1, signed_uploaded: 2, zav_received: 3, done: 3 };

/** Shrinks phone photos to a sensible JPEG so uploads stay under the size limit. */
async function prepareFile(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return file;
  if (file.type === "image/png" && file.size < 1.5 * 1024 * 1024) return file;
  if (file.type === "image/jpeg" && file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function CabinetApp({ view, locale }: { view: CabinetView; locale: CabinetLocale }) {
  const t = CABINET_TEXT[locale];
  const router = useRouter();
  const formId = useId();
  const editable = view.status === "waiting_data" || view.status === "declaration_ready";
  const step = STEP_OF[view.status];

  const [data, setData] = useState<CabinetData>(() => {
    const d: CabinetData = { ...view.data };
    for (const s of CABINET_SECTIONS) for (const f of s.fields) if (!d[f.key] && f.defaultValue) d[f.key] = f.defaultValue;
    return d;
  });
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [busy, setBusy] = useState<null | "save" | "submit" | UploadKind>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [files, setFiles] = useState(view.files);

  const set = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
  };

  async function post(submit: boolean) {
    const res = await fetch("/api/cabinet/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, submit }),
    });
    return { res, json: (await res.json().catch(() => ({}))) as { errors?: Record<string, FieldError>; missingFiles?: string[] } };
  }

  async function onSave() {
    setBusy("save");
    setNotice(null);
    try {
      const { res } = await post(false);
      setNotice(res.ok ? { tone: "ok", text: t.saved } : { tone: "err", text: t.errorGeneric });
    } catch {
      setNotice({ tone: "err", text: t.errorGeneric });
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setNotice(null);
    const errs = validateCabinetData(data);
    const missing = !files.passport || !files.enrollment;
    setErrors(errs);
    if (Object.keys(errs).length || missing) {
      setNotice({ tone: "err", text: Object.keys(errs).length ? t.fixErrors : t.needFiles });
      const first = Object.keys(errs)[0];
      if (first) document.getElementById(`${formId}-${first}`)?.focus();
      if (Object.keys(errs).length) await post(false).catch(() => null); // keep what was typed
      return;
    }
    setBusy("submit");
    try {
      const { res, json } = await post(true);
      if (res.ok) {
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.status === 422) {
        setErrors(json.errors ?? {});
        setNotice({ tone: "err", text: json.missingFiles?.length ? t.needFiles : t.fixErrors });
      } else setNotice({ tone: "err", text: t.errorGeneric });
    } catch {
      setNotice({ tone: "err", text: t.errorGeneric });
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: UploadKind, picked: File) {
    setNotice(null);
    const file = await prepareFile(picked);
    if (file.size > MAX_UPLOAD_BYTES) return setNotice({ tone: "err", text: t.errTooLarge });
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/cabinet/upload?kind=${kind}`, { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { file?: FileMeta; error?: string };
      if (res.ok && json.file) {
        setFiles((f) => ({ ...f, [kind]: json.file! }));
        if (kind === "signed") router.refresh();
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

  async function logout() {
    await fetch("/api/cabinet/logout", { method: "POST" }).catch(() => null);
    router.refresh();
  }

  return (
    <section className="container-x py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t.service}</p>
            <h1 className="h-section mt-2">
              {t.hello}, {view.name}
            </h1>
          </div>
          <button type="button" onClick={logout} className="btn-ghost min-h-10 shrink-0 px-3 text-[14px]">
            <LogOut className="h-4 w-4" /> {t.logout}
          </button>
        </div>

        <ol className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t.title}>
          {t.steps.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={clsx(
                "rounded-xl border px-3 py-2.5 text-[13px] font-semibold leading-tight sm:text-[14px]",
                i < step || view.status === "done" ? "border-accent/30 bg-accent-soft text-ink" : i === step ? "border-brand bg-brand-soft text-ink" : "border-line text-muted"
              )}
            >
              <span className="mr-1.5 tabular-nums">{i + 1}.</span>
              {label}
            </li>
          ))}
        </ol>

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

        {view.status === "done" && <Banner title={t.doneTitle} text={t.doneText} />}
        {view.status === "signed_uploaded" && <Banner tone="wait" title={t.zavWaitTitle} text={t.zavWaitText} />}
        {(view.status === "zav_received" || view.status === "done") && <ZavCard view={view} t={t} hasFile={Boolean(files.zav)} />}

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
            {view.declarationDate && (
              <p className="mt-3 text-[14px] text-muted">
                {t.declDate}: {toGermanDate(view.declarationDate)}
              </p>
            )}
            <a href="/api/cabinet/file/declaration" download className={clsx("mt-5", view.status === "declaration_ready" ? "btn-primary" : "btn-ghost")}>
              <Download className="h-4 w-4" /> {t.download}
            </a>

            {(view.status === "declaration_ready" || view.status === "signed_uploaded") && (
              <div className="mt-6 border-t border-line pt-5">
                <FileRow
                  label={t.signedTitle}
                  meta={files.signed}
                  busy={busy === "signed"}
                  t={t}
                  buttonText={files.signed ? t.replace : t.signedUpload}
                  onPick={(f) => upload("signed", f)}
                />
              </div>
            )}
            {view.status === "declaration_ready" && <p className="mt-5 text-[14px] leading-relaxed text-muted">{t.editAgain}</p>}
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
            {!files.declaration && (
              <div className="card p-5 sm:p-7">
                <h2 className="h-card">{t.introTitle}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{t.introText}</p>
              </div>
            )}

            {CABINET_SECTIONS.map((section) => (
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
              <p className="mt-2 text-[14px] text-muted">{t.documentsHint}</p>
              <div className="mt-5 space-y-4">
                {(["passport", "enrollment"] as const).map((kind) => (
                  <FileRow
                    key={kind}
                    label={FILE_LABELS[kind][locale]}
                    meta={files[kind]}
                    busy={busy === kind}
                    t={t}
                    buttonText={files[kind] ? t.replace : t.upload}
                    onPick={(f) => upload(kind, f)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="btn-primary sm:flex-1" disabled={busy !== null}>
                {busy === "submit" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.submitting}
                  </>
                ) : (
                  t.submit
                )}
              </button>
              <button type="button" className="btn-ghost" onClick={onSave} disabled={busy !== null}>
                {busy === "save" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.saving}
                  </>
                ) : (
                  t.saveDraft
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

type T = (typeof CABINET_TEXT)[CabinetLocale];

function Banner({ title, text, tone = "ok" }: { title: string; text: string; tone?: "ok" | "wait" }) {
  return (
    <div className={clsx("mt-6 flex items-start gap-3 rounded-2xl p-5", tone === "wait" ? "bg-brand-soft" : "bg-accent-soft")}>
      {tone === "wait" ? (
        <Hourglass className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
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
      ) : (
        <>
          <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">
            {f.label[locale]} {f.optional && <span className="font-normal text-muted">({t.optional})</span>}
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
  meta,
  busy,
  t,
  buttonText,
  onPick,
}: {
  label: string;
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

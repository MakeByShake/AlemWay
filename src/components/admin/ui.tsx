"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, Loader2, Upload } from "lucide-react";
import type { ActionState } from "@/app/admin/actions";
import { compressForUpload } from "@/lib/compress-file";
import { welcomeMessage } from "@/lib/cabinet/whatsapp-template";

/**
 * Small client pieces of the admin: buttons with pending state, auto-saving selects, confirm, copy, upload.
 * Forms here submit through onSubmit + a transition instead of the `action` prop: React resets forms
 * after an `action`, and that snapped <select>s back to their first option (looked like «не назначен»).
 */

const PendingCtx = createContext<boolean | null>(null);

/** Submit handler that runs `run(formData)` in a transition without resetting the form. */
function useSubmit(run: (fd: FormData) => Promise<unknown> | void) {
  const [pending, startTransition] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const native = e.nativeEvent as SubmitEvent;
    const fd = new FormData(e.currentTarget, native.submitter ?? undefined);
    startTransition(async () => {
      await run(fd);
    });
  };
  return { pending, onSubmit };
}

export function SubmitButton({ children, className, pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const ctx = useContext(PendingCtx);
  const status = useFormStatus();
  const pending = ctx ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={clsx(className ?? "btn-primary", "disabled:opacity-60")}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** A <select> that saves as soon as it changes. */
export function AutoSelect({
  action,
  hidden,
  name,
  value,
  options,
  className,
  label = "Статус",
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: readonly { value: string; title: string }[];
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const { pending: busy, onSubmit } = useSubmit(action);
  return (
    <form ref={ref} onSubmit={onSubmit}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <select
        name={name}
        defaultValue={value}
        disabled={busy}
        onChange={() => ref.current?.requestSubmit()}
        className={clsx("rounded-lg border border-line bg-white px-2.5 py-1.5 text-[14px] font-medium disabled:opacity-60", className)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.title}
          </option>
        ))}
      </select>
    </form>
  );
}

/** A form with one submit button that asks for confirmation first (deleting). */
export function ConfirmForm({
  action,
  hidden,
  confirmText,
  children,
  className,
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  confirmText: string;
  children: ReactNode;
  className?: string;
}) {
  const { pending, onSubmit } = useSubmit(action);
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) return e.preventDefault();
        onSubmit(e);
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <PendingCtx.Provider value={pending}>
        <SubmitButton className={className ?? "text-[14px] font-medium text-red-600 hover:underline"}>{children}</SubmitButton>
      </PendingCtx.Provider>
    </form>
  );
}

/** Note field that saves on button press. */
export function NoteForm({ action, id, value, placeholder }: { action: (fd: FormData) => Promise<void>; id: string; value?: string; placeholder?: string }) {
  const [saved, setSaved] = useState(false);
  const { pending, onSubmit } = useSubmit(async (fd) => {
    await action(fd);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  });
  return (
    <form onSubmit={onSubmit} className="flex items-start gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="managerNote"
        defaultValue={value}
        rows={1}
        placeholder={placeholder ?? "Заметка менеджера…"}
        className="min-h-9 flex-1 resize-y rounded-lg border border-line bg-white px-3 py-1.5 text-[14px]"
      />
      <PendingCtx.Provider value={pending}>
        <SubmitButton className="btn-ghost min-h-9 px-3 text-[13px]">{saved ? <Check className="h-4 w-4 text-accent" /> : "Сохранить"}</SubmitButton>
      </PendingCtx.Provider>
    </form>
  );
}

export function CopyButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost min-h-9 px-3 text-[13px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Скопируйте:", text);
        }
      }}
    >
      {done ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />} {done ? "Скопировано" : label}
    </button>
  );
}

/** Shows a fresh client login link with copy + «send to WhatsApp». */
export function LinkBox({ link, phone, name, curator, service }: { link: string; phone?: string; name?: string; curator?: string; service?: string }) {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^8(\d{10})$/, "7$1");
  const text = welcomeMessage({ name, link, curator, service });
  return (
    <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
      <p className="text-[14px] font-semibold">Ссылка для клиента (видна только сейчас — скопируйте):</p>
      <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-[13px]">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={link} label="Скопировать ссылку" />
        <CopyButton text={text} label="Скопировать шаблон" />
        {digits.length >= 11 && (
          <a className="btn-whatsapp min-h-9 px-3 text-[13px]" href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            Отправить шаблон в WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

/** Generic form bound to a server action with useActionState; shows errors/messages and an optional link. */
export function ActionForm({
  action,
  children,
  className,
  phone,
  resetOnSuccess,
  autoSave,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  phone?: string;
  resetOnSuccess?: boolean;
  /** Save by itself shortly after any field changes (no «Сохранить» button needed). */
  autoSave?: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await action(prev, fd);
    if (autoSave && res?.ok) setTick((n) => n + 1);
    return res;
  }, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [waiting, setWaiting] = useState(false);
  // Clear the inputs after a successful «add» form (only where asked); edit forms keep their values.
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const send = () => {
    setWaiting(false);
    if (!ref.current) return;
    const fd = new FormData(ref.current);
    startTransition(() => formAction(fd));
  };
  // Text: wait until typing pauses; selects, dates, checkboxes: save right away.
  const schedule = (e: FormEvent<HTMLFormElement>) => {
    if (!autoSave) return;
    const el = e.target as HTMLInputElement;
    const typing = (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && !["date", "checkbox", "radio", "file"].includes(el.type);
    if (el.type === "file") return;
    if (e.type === "change" && typing) return; // already handled by «input»
    clearTimeout(timer.current);
    setWaiting(true);
    timer.current = setTimeout(send, typing ? 900 : 150);
  };

  const saving = waiting || pending;
  return (
    <div>
      <form
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(timer.current);
          setWaiting(false);
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter ?? undefined);
          startTransition(() => formAction(fd));
        }}
        onInput={schedule}
        onChange={schedule}
        className={className}
      >
        <PendingCtx.Provider value={pending}>{children}</PendingCtx.Provider>
      </form>
      {autoSave && (saving || tick > 0) && !state?.error && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px]" aria-live="polite">
          {saving ? (
            <span className="flex items-center gap-1.5 text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Сохраняем…
            </span>
          ) : (
            <span key={tick} className="saved-pop flex items-center gap-1.5 font-semibold text-accent">
              <Check className="h-4 w-4" /> Сохранено
            </span>
          )}
        </p>
      )}
      {autoSave && tick > 0 && !saving && !state?.error && (
        <div
          key={`t${tick}`}
          aria-hidden
          className="saved-toast pointer-events-none fixed bottom-5 left-1/2 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-white shadow-lg"
        >
          <Check className="h-4 w-4" /> Сохранено
        </div>
      )}
      {state?.error && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn">{state.error}</p>}
      {state?.message && !autoSave && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[14px]">{state.message}</p>}
      {state?.link && (
        <div className="mt-3">
          <LinkBox link={state.link} phone={state.phone || phone} name={state.clientName} curator={state.curator} service={state.service} />
          {state.id && (
            <Link prefetch={false} href={`/admin/clients/${state.id}`} className="mt-2 inline-block text-[14px] font-medium text-brand hover:underline">
              Открыть карточку клиента →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Manager uploads/replaces a file of a cabinet via /api/admin/cabinet/upload. */
export function FileUpload({ id, kind, label }: { id: string; kind: string; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={async (e) => {
          const picked = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!picked) return;
          setBusy(true);
          setError(null);
          try {
            const file = await compressForUpload(picked);
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch(`/api/admin/cabinet/upload?id=${encodeURIComponent(id)}&kind=${kind}`, { method: "POST", body: fd });
            const j = (await res.json().catch(() => ({}))) as { message?: string };
            if (!res.ok) throw new Error(j.message || `Ошибка ${res.status}`);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-ghost min-h-9 px-3 text-[13px] disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label}
      </button>
      {error && <span className="mt-1 text-[13px] text-warn">{error}</span>}
    </span>
  );
}

/** One-button form (confirm / reject a payment…) that doesn't reset anything. */
export function QuickButton({
  action,
  hidden,
  children,
  className,
  confirmText,
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const { pending, onSubmit } = useSubmit(action);
  return (
    <form
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) return e.preventDefault();
        onSubmit(e);
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <PendingCtx.Provider value={pending}>
        <SubmitButton className={className ?? "btn-ghost min-h-8 px-2.5 text-[13px]"}>{children}</SubmitButton>
      </PendingCtx.Provider>
    </form>
  );
}

/** Manager adds a payment (optionally with a receipt) via /api/admin/cabinet/payment. */
export function AddPaymentForm({ id, methods }: { id: string; methods: readonly { value: string; title: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError(null);
        try {
          const fd = new FormData(form);
          fd.set("id", id);
          fd.delete("file");
          // Big photos of receipts are shrunk in the browser first (the server takes up to 4 MB).
          if (receipt) fd.set("file", await compressForUpload(receipt));
          const res = await fetch("/api/admin/cabinet/payment", { method: "POST", body: fd });
          const j = (await res.json().catch(() => ({}))) as { message?: string };
          if (!res.ok) throw new Error(j.message || `Ошибка ${res.status}`);
          form.reset();
          setReceipt(null);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="grid gap-1 text-[13px] font-medium">
        Сумма, ₸
        <input name="amount" inputMode="numeric" required placeholder="50000" className="field py-2 text-[15px]" />
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Способ
        <select name="method" className="field py-2 text-[15px]">
          {methods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[13px] font-medium">
        Дата оплаты
        <input name="paidAt" type="date" defaultValue={today} className="field py-2 text-[15px]" />
      </label>
      <div className="grid gap-1 text-[13px] font-medium">
        Чек (необязательно)
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
        />
        {receipt ? (
          <div className="flex min-h-[42px] items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-3 text-[14px]">
            <Check className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate font-medium" title={receipt.name}>
              {receipt.name}
            </span>
            <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 text-[13px] font-semibold text-brand hover:underline">
              Заменить
            </button>
            <button
              type="button"
              aria-label="Убрать чек"
              onClick={() => {
                setReceipt(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="shrink-0 px-1 text-[16px] leading-none text-muted hover:text-red-600"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 px-3 text-[14px] font-semibold text-brand hover:border-brand hover:bg-brand-soft"
          >
            <Upload className="h-4 w-4" /> Загрузить чек
          </button>
        )}
      </div>
      <label className="grid gap-1 text-[13px] font-medium sm:col-span-2">
        Комментарий
        <input name="note" placeholder="Например: предоплата 50%" className="field py-2 text-[15px]" />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="btn-primary min-h-10 px-4 text-[14px] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Добавить оплату
        </button>
        {error && <p className="mt-2 text-[13px] text-warn">{error}</p>}
      </div>
    </form>
  );
}

/** Closes the surrounding <details> (e.g. «+ Новый клиент») and clears its form. */
export function CloseDetailsButton({ label = "Отмена" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={(e) => {
        const details = e.currentTarget.closest("details");
        details?.querySelector("form")?.reset();
        if (details) details.open = false;
      }}
    >
      {label}
    </button>
  );
}

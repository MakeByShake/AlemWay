"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, Loader2, Upload } from "lucide-react";
import type { ActionState } from "@/app/admin/actions";

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
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string;
  options: readonly { value: string; title: string }[];
  className?: string;
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
        aria-label="Статус"
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
export function LinkBox({ link, phone }: { link: string; phone?: string }) {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^8(\d{10})$/, "7$1");
  const text = `Здравствуйте! Ваш личный кабинет AlemWay: ${link}\nСсылка личная — не пересылайте её никому.`;
  return (
    <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
      <p className="text-[14px] font-semibold">Ссылка для клиента (видна только сейчас — скопируйте):</p>
      <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-[13px]">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={link} label="Скопировать ссылку" />
        {digits.length >= 11 && (
          <a className="btn-whatsapp min-h-9 px-3 text-[13px]" href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            Отправить в WhatsApp
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
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  phone?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  // Clear the inputs after a successful «add» form (only where asked); edit forms keep their values.
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <div>
      <form
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter ?? undefined);
          startTransition(() => formAction(fd));
        }}
        className={className}
      >
        <PendingCtx.Provider value={pending}>{children}</PendingCtx.Provider>
      </form>
      {state?.error && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn">{state.error}</p>}
      {state?.message && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[14px]">{state.message}</p>}
      {state?.link && (
        <div className="mt-3">
          <LinkBox link={state.link} phone={phone} />
          {state.id && (
            <Link href={`/admin/clients/${state.id}`} className="mt-2 inline-block text-[14px] font-medium text-brand hover:underline">
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
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
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

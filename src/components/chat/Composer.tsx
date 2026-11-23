"use client";

import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { Loader2, Paperclip, Send } from "lucide-react";

/** The input row of a chat: attach a file, type, send. Enter sends on a computer; on a phone it makes a new line. */
export function Composer({
  value,
  onChange,
  onSend,
  onPick,
  busy = false,
  uploading = false,
  placeholder,
  sendLabel,
  attachLabel,
  maxLength,
  tone = "plain",
  allowEmpty = false,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** No handler — no paperclip. */
  onPick?: (file: File) => void;
  busy?: boolean;
  uploading?: boolean;
  placeholder: string;
  sendLabel: string;
  attachLabel: string;
  maxLength: number;
  /** note — the yellow look of a note for the team. */
  tone?: "plain" | "note";
  /** Sending without text is fine (a file is attached). */
  allowEmpty?: boolean;
  /** Extra controls above the input. */
  children?: ReactNode;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // Grows with the text up to about five lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value]);

  const canSend = !busy && (allowEmpty || value.trim().length > 0);
  return (
    <div className="border-t border-line bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
      {children}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
      >
        {onPick && (
          <>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onPick(f);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => file.current?.click()}
              aria-label={attachLabel}
              title={attachLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
          </>
        )}
        <textarea
          ref={area}
          rows={1}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            // Phones and tablets: Enter is a new line, sending is the button.
            if (window.matchMedia("(pointer: coarse)").matches) return;
            e.preventDefault();
            if (canSend) onSend();
          }}
          className={clsx(
            "min-h-11 flex-1 resize-none rounded-[22px] border px-4 py-2.5 text-base leading-snug text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20",
            tone === "note" ? "border-[#e6c65c] bg-[#fff8dc]" : "border-line bg-surface"
          )}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          title={sendLabel}
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:opacity-40",
            tone === "note" ? "bg-[#b8860b] hover:bg-[#9a7009]" : "bg-brand hover:bg-brand-dark"
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { reformOldClientAction } from "@/app/admin/actions";
import {
  oldClientMessage,
  type OldClientLang,
} from "@/lib/cabinet/old-client-message";
import { welcomeMessage } from "@/lib/cabinet/whatsapp-template";

const DEADLINE_KEY = "aw_old_client_deadline";

/**
 * «Новый бланк 06/2026» for an old client: makes a fresh login link (optionally resetting the questionnaire)
 * and the ready message with the client's name, link and deadline — copy, send to WhatsApp or download.
 */
export function OldClientMessage({
  id,
  name: defaultName,
  phone,
  reformed,
  old,
  curator,
}: {
  id: string;
  name: string;
  phone?: string;
  reformed: boolean;
  old: boolean;
  curator?: string;
}) {
  const [state, action, pending] = useActionState(reformOldClientAction, null);
  const [, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [deadline, setDeadline] = useState("");
  const [lang, setLang] = useState<OldClientLang>("ru");
  // Old clients get the «new form, fill in again» message; site clients the usual welcome with the link (2 copies included).
  const [mode, setMode] = useState<"old" | "site">(old ? "old" : "site");
  const [reset, setReset] = useState(old && !reformed);
  const [copied, setCopied] = useState(false);

  const link = state?.ok ? state.link : undefined;
  const text = !link
    ? ""
    : mode === "old"
      ? oldClientMessage({
          name: name.trim() || "{Имя}",
          link,
          deadline: deadline.trim() || "{срок}",
          lang,
        })
      : welcomeMessage({
          name: name.trim(),
          link,
          curator,
          service: "ferienjob",
        });
  const digits = (state?.phone || phone || "")
    .replace(/\D/g, "")
    .replace(/^8(\d{10})$/, "7$1");

  const remember = (v: string) => {
    setDeadline(v);
    try {
      localStorage.setItem(DEADLINE_KEY, v);
    } catch {}
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["old", "Старый клиент — анкета заново"],
            ["site", "Клиент с сайта — обычное приветствие"],
          ] as const
        ).map(([v, title]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setMode(v);
              if (v === "site") setReset(false);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium ${mode === v ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[14px] font-medium">
          Имя в приветствии
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field py-2 text-[15px]"
            placeholder="Алихан"
          />
        </label>
        {mode === "old" && (
          <label className="grid gap-1 text-[14px] font-medium">
            Срок («Просим сделать это до …»)
            <input
              value={deadline}
              onChange={(e) => remember(e.target.value)}
              onFocus={() => {
                if (deadline) return;
                try {
                  const saved = localStorage.getItem(DEADLINE_KEY);
                  if (saved) setDeadline(saved);
                } catch {}
              }}
              className="field py-2 text-[15px]"
              placeholder="1 декабря"
            />
          </label>
        )}
      </div>
      {mode === "old" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="font-medium">Язык:</span>
          {(
            [
              ["ru", "Русский"],
              ["kk", "Қазақша"],
              ["both", "Оба"],
            ] as const
          ).map(([v, title]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="lang"
                checked={lang === v}
                onChange={() => setLang(v)}
              />{" "}
              {title}
            </label>
          ))}
        </div>
      )}
      {mode === "old" && (
        <label className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px]">
          <input
            type="checkbox"
            checked={reset}
            onChange={(e) => setReset(e.target.checked)}
            className="mt-1"
          />
          <span>
            <b>Обнулить анкету и документы для декларации</b> — останутся имя и
            телефон, клиент заполнит всё заново. Старые файлы не удаляются, а
            уходят в архив (вкладка «Файлы»).
            {reformed && (
              <span className="mt-1 block text-muted">
                Этого клиента уже обнуляли — второй раз обычно не нужно.
              </span>
            )}
          </span>
        </label>
      )}
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              mode === "old" &&
              reset &&
              !window.confirm(
                "Обнулить анкету и документы для декларации? Старые файлы уйдут в архив.",
              )
            )
              return;
            const fd = new FormData();
            fd.set("id", id);
            fd.set("reset", mode === "old" && reset ? "yes" : "no");
            startTransition(() => action(fd));
          }}
          className="btn-primary min-h-10 px-4 text-[14px] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
          {link ? "Создать заново" : "Создать ссылку и текст"}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn">
          {state.error}
        </p>
      )}

      {link && (
        <div className="rounded-xl border border-accent/40 bg-accent-soft p-3 sm:p-4">
          <p className="mb-2 text-[13px] font-semibold">
            Готовый текст (имя и срок меняются в полях выше):
          </p>
          <textarea
            readOnly
            value={text}
            rows={12}
            className="w-full rounded-lg border border-line bg-white p-3 text-[13.5px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost min-h-9 px-3 text-[13px]"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  window.prompt("Скопируйте:", text);
                }
              }}
            >
              {copied ? (
                <Check className="h-4 w-4 text-accent" />
              ) : (
                <Copy className="h-4 w-4" />
              )}{" "}
              {copied ? "Скопировано" : "Скопировать текст"}
            </button>
            {digits.length >= 11 && (
              <a
                className="btn-whatsapp min-h-9 px-3 text-[13px]"
                href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Отправить в WhatsApp
              </a>
            )}
            <button
              type="button"
              className="btn-ghost min-h-9 px-3 text-[13px]"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(
                  new Blob([text], { type: "text/plain;charset=utf-8" }),
                );
                a.download = `Novyi-blank-${(name || "klient").replace(/[^\wА-Яа-яЁё-]+/g, "-")}.txt`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Download className="h-4 w-4" /> Скачать .txt
            </button>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            Ссылка в тексте — новая личная ссылка клиента; прежние ссылки тоже
            продолжают работать.
          </p>
        </div>
      )}
    </div>
  );
}

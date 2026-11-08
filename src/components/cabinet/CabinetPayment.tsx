"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { KASPI_PAY_URL, formatTenge } from "@/lib/cabinet/payments";

type Item = { amount: number; status: "pending" | "confirmed" | "rejected"; paidAt?: string };
export type PaymentView = { price: number; paid: number; pending: number; remaining: number; hasPrice: boolean; items: Item[] };

const TEXT = {
  ru: {
    title: "Оплата",
    toPay: "К оплате",
    paid: "Оплачено",
    left: "Осталось",
    noPrice: "Сумму к оплате сообщит менеджер.",
    allPaid: "Оплачено полностью. Спасибо!",
    pay: "Оплатить через Kaspi",
    attach: "Прикрепить чек",
    amount: "Сумма в чеке, ₸",
    file: "Чек (фото или PDF из Kaspi)",
    send: "Отправить чек",
    sending: "Отправляем…",
    sent: "Чек отправлен. Менеджер проверит его и подтвердит оплату.",
    history: "Ваши платежи",
    st: { pending: "на проверке", confirmed: "подтверждён", rejected: "отклонён — напишите менеджеру" },
    errors: {
      bad_amount: "Укажите сумму из чека.",
      no_file: "Выберите файл чека.",
      too_large: "Файл больше 4 МБ.",
      bad_type: "Подойдёт только PDF, JPG или PNG.",
      too_many: "Уже есть несколько чеков на проверке. Дождитесь подтверждения.",
      default: "Не получилось. Попробуйте ещё раз или напишите менеджеру.",
    } as Record<string, string>,
  },
  kk: {
    title: "Төлем",
    toPay: "Төлеуге",
    paid: "Төленді",
    left: "Қалды",
    noPrice: "Төлем сомасын менеджер хабарлайды.",
    allPaid: "Толық төленді. Рақмет!",
    pay: "Kaspi арқылы төлеу",
    attach: "Чекті тіркеу",
    amount: "Чектегі сома, ₸",
    file: "Чек (фото немесе Kaspi PDF)",
    send: "Чекті жіберу",
    sending: "Жіберілуде…",
    sent: "Чек жіберілді. Менеджер тексеріп, төлемді растайды.",
    history: "Сіздің төлемдеріңіз",
    st: { pending: "тексерілуде", confirmed: "расталды", rejected: "қабылданбады — менеджерге жазыңыз" },
    errors: {
      bad_amount: "Чектегі соманы көрсетіңіз.",
      no_file: "Чек файлын таңдаңыз.",
      too_large: "Файл 4 МБ-тан үлкен.",
      bad_type: "Тек PDF, JPG немесе PNG.",
      too_many: "Тексерудегі чектер бар. Растауды күтіңіз.",
      default: "Болмады. Қайталап көріңіз немесе менеджерге жазыңыз.",
    } as Record<string, string>,
  },
};

export function CabinetPayment({ view, locale }: { view: PaymentView; locale: "ru" | "kk" }) {
  const t = TEXT[locale];
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = view.hasPrice && view.remaining === 0;

  return (
    <section className="container-x pb-6">
      <div className="card mx-auto max-w-3xl p-6">
        <h2 className="text-[20px] font-bold">{t.title}</h2>
        {view.hasPrice ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface px-2 py-3">
              <p className="text-[13px] text-muted">{t.toPay}</p>
              <p className="text-[17px] font-bold tabular-nums">{formatTenge(view.price)}</p>
            </div>
            <div className="rounded-xl bg-accent-soft px-2 py-3">
              <p className="text-[13px] text-muted">{t.paid}</p>
              <p className="text-[17px] font-bold tabular-nums">{formatTenge(view.paid)}</p>
            </div>
            <div className={clsx("rounded-xl px-2 py-3", view.remaining > 0 ? "bg-warn-soft" : "bg-surface")}>
              <p className="text-[13px] text-muted">{t.left}</p>
              <p className="text-[17px] font-bold tabular-nums">{formatTenge(view.remaining)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-muted">{t.noPrice}</p>
        )}

        {done ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[15px] font-semibold">
            <CheckCircle2 className="h-5 w-5 text-accent" /> {t.allPaid}
          </p>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={KASPI_PAY_URL} target="_blank" rel="noopener noreferrer" className="btn-primary bg-[#f14635] hover:bg-[#d93a2a]">
              {t.pay}
            </a>
            <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost">
              <Upload className="h-4 w-4" /> {t.attach}
            </button>
          </div>
        )}

        {open && !done && (
          <form
            ref={form}
            className="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMsg(null);
              try {
                const res = await fetch("/api/cabinet/payment", { method: "POST", body: new FormData(e.currentTarget) });
                const j = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) throw new Error(t.errors[j.error ?? ""] ?? t.errors.default);
                form.current?.reset();
                setOpen(false);
                setMsg({ ok: true, text: t.sent });
                router.refresh();
              } catch (err) {
                setMsg({ ok: false, text: err instanceof Error ? err.message : t.errors.default });
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-[14px] font-medium">
              {t.amount}
              <input name="amount" inputMode="numeric" required defaultValue={view.remaining || ""} className="field" />
            </label>
            <label className="grid gap-1 text-[14px] font-medium">
              {t.file}
              <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className="text-[14px]" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? t.sending : t.send}
              </button>
            </div>
          </form>
        )}

        {msg && <p className={clsx("mt-4 rounded-xl px-4 py-3 text-[15px]", msg.ok ? "bg-accent-soft" : "bg-warn-soft text-warn")}>{msg.text}</p>}

        {view.items.length > 0 && (
          <div className="mt-5">
            <p className="text-[14px] font-semibold">{t.history}</p>
            <ul className="mt-2 divide-y divide-line text-[14px]">
              {view.items.map((p, i) => (
                <li key={i} className="flex justify-between gap-3 py-2">
                  <span className="tabular-nums">
                    {formatTenge(p.amount)} <span className="text-muted">· {p.paidAt ? p.paidAt.split("-").reverse().join(".") : ""}</span>
                  </span>
                  <span className={clsx(p.status === "confirmed" ? "text-[#0a7a42]" : p.status === "rejected" ? "text-warn" : "text-muted")}>{t.st[p.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

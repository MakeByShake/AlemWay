import clsx from "clsx";
import { CheckCircle2 } from "lucide-react";
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
    afterPay: "После оплаты отправьте чек менеджеру в WhatsApp — он отметит оплату.",
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
    afterPay: "Төлегеннен кейін чекті WhatsApp-та менеджерге жіберіңіз — ол төлемді белгілейді.",
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
            <p className="w-full text-[14px] text-muted">{t.afterPay}</p>
          </div>
        )}


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

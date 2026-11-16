/**
 * Payments of a client (shared by client and server code — no server-only imports).
 * The manager sets the price; the client attaches receipts (status «pending»); the manager confirms them
 * or adds payments himself (cash, transfer). Only confirmed payments count as paid.
 */

/** Kaspi payment link for clients. */
export const KASPI_PAY_URL = "https://pay.kaspi.kz/pay/v5objjdq";
/** Default price by service (₸); null = the manager sets it. */
export const DEFAULT_PRICE: Record<string, number | null> = { keta: 12000, ferienjob: null };

export const PAYMENT_METHODS = [
  { value: "kaspi", title: "Kaspi" },
  { value: "transfer", title: "Перевод на счёт" },
  { value: "cash", title: "Наличные" },
  { value: "other", title: "Другое" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export type PaymentStatus = "pending" | "confirmed" | "rejected";
export const PAYMENT_STATUS_TITLES: Record<PaymentStatus, string> = {
  pending: "Чек на проверке",
  confirmed: "Подтверждено",
  rejected: "Отклонено",
};

export type Receipt = { path: string; name: string; contentType: string; size: number; uploadedAt: string; _key?: string };

export type Payment = {
  _key: string;
  amount: number;
  /** «refund» = money given back to the client: subtracted from what was paid. */
  kind?: "payment" | "refund";
  method?: PaymentMethod;
  paidAt?: string; // YYYY-MM-DD
  note?: string;
  /** Who actually paid, when it isn't the client (mother, friend…). */
  payer?: string;
  /** First receipt (older payments have only this one). */
  receipt?: Receipt;
  /** More receipts of the same payment. */
  receipts?: Receipt[];
  status: PaymentStatus;
  by?: string; // "client" or manager login
  byName?: string;
  createdAt: string;
};

/** One part of the payment plan: «Предоплата 50%» — 375 000 ₸ — до 20.11. */
export type PlanItem = { _key: string; title: string; amount: number; dueDate?: string };
export type PlanState = PlanItem & { paid: number; left: number; state: "paid" | "partial" | "overdue" | "waiting" };

/** All receipts of a payment, the old single one first. */
export const receiptsOf = (p: Payment): Receipt[] => [...(p.receipt ? [{ ...p.receipt, _key: p.receipt._key ?? "main" }] : []), ...(p.receipts ?? [])];

/** Plan presets: shares of the total and in how many days each part is due (null = today). */
export const PLAN_PRESETS = [
  { id: "full", title: "100% сразу", parts: [{ title: "Оплата полностью", share: 1, days: 0 }] },
  { id: "half", title: "50 / 50", parts: [{ title: "Предоплата 50%", share: 0.5, days: 0 }, { title: "Остаток 50%", share: 0.5, days: 30 }] },
  { id: "30-70", title: "30 / 70", parts: [{ title: "Предоплата 30%", share: 0.3, days: 0 }, { title: "Остаток 70%", share: 0.7, days: 30 }] },
  { id: "three", title: "3 части", parts: [{ title: "1-я часть", share: 1 / 3, days: 0 }, { title: "2-я часть", share: 1 / 3, days: 30 }, { title: "3-я часть", share: 1 / 3, days: 60 }] },
  { id: "debt", title: "Всё в долг", parts: [{ title: "Оплата в долг", share: 1, days: 30 }] },
] as const;

export function paymentTotals(
  price: number | undefined | null,
  payments: Payment[] | undefined | null,
  opts: { discount?: number | null; plan?: PlanItem[] | null; today?: string } = {}
) {
  const list = payments ?? [];
  const sign = (p: Payment) => (p.kind === "refund" ? -1 : 1);
  const paid = list.filter((p) => p.status === "confirmed").reduce((s, p) => s + sign(p) * (p.amount || 0), 0);
  const refunded = list.filter((p) => p.status === "confirmed" && p.kind === "refund").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = list.filter((p) => p.status === "pending").reduce((s, p) => s + sign(p) * (p.amount || 0), 0);
  const full = price ?? 0;
  const discount = Math.min(Math.max(opts.discount ?? 0, 0), full);
  const total = full - discount;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  // What was paid covers the plan parts in order of their dates.
  let pool = Math.max(paid, 0);
  const plan: PlanState[] = [...(opts.plan ?? [])]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .map((it) => {
      const got = Math.min(pool, it.amount);
      pool -= got;
      const left = it.amount - got;
      const state = left <= 0 ? "paid" : it.dueDate && it.dueDate < today ? "overdue" : got > 0 ? "partial" : "waiting";
      return { ...it, paid: got, left, state };
    });
  const next = plan.find((p) => p.left > 0);
  const overdue = plan.filter((p) => p.state === "overdue").reduce((s, p) => s + p.left, 0);
  return {
    price: total,
    fullPrice: full,
    discount,
    paid,
    refunded,
    pending,
    remaining: Math.max(total - paid, 0),
    overpaid: Math.max(paid - total, 0),
    hasPrice: Boolean(price),
    plan,
    next,
    overdue,
  };
}

export const formatTenge = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))}\u00a0₸`;

/** Parses «12 000», «12000 ₸», «12,000» → 12000. Returns null for anything that isn't a positive amount. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = Number(String(raw).replace(/[\s ,₸тг]/gi, ""));
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n) : null;
}

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

export type Receipt = { path: string; name: string; contentType: string; size: number; uploadedAt: string };

export type Payment = {
  _key: string;
  amount: number;
  method?: PaymentMethod;
  paidAt?: string; // YYYY-MM-DD
  note?: string;
  receipt?: Receipt;
  status: PaymentStatus;
  by?: string; // "client" or manager login
  byName?: string;
  createdAt: string;
};

export function paymentTotals(price: number | undefined | null, payments: Payment[] | undefined | null) {
  const list = payments ?? [];
  const paid = list.filter((p) => p.status === "confirmed").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = list.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);
  const total = price ?? 0;
  return { price: total, paid, pending, remaining: Math.max(total - paid, 0), hasPrice: Boolean(price) };
}

export const formatTenge = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))}\u00a0₸`;

/** Parses «12 000», «12000 ₸», «12,000» → 12000. Returns null for anything that isn't a positive amount. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = Number(String(raw).replace(/[\s ,₸тг]/gi, ""));
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n) : null;
}

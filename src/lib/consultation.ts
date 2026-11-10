/**
 * Consultations: 2 000 ₸, working days, 10:00–19:00 (Almaty), one hour each.
 * Shared by the booking form, the API and the admin — no server-only imports.
 */

export const CONSULTATION_PRICE = 2000;
export const CONSULTATION_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"] as const;
/** How many people can book the same hour (one consultant per slot for now). */
export const SLOT_CAPACITY = 1;
/** How far ahead clients can book. */
export const BOOKING_DAYS = 14;

export const CONSULTATION_TOPICS = [
  { value: "ferienjob", ru: "Работа в Германии (Ferienjob)", kk: "Германиядағы жұмыс (Ferienjob)" },
  { value: "keta", ru: "K-ETA в Южную Корею", kk: "Оңтүстік Кореяға K-ETA" },
  { value: "australia", ru: "Виза в Австралию", kk: "Австралияға виза" },
  { value: "other", ru: "Другой вопрос", kk: "Басқа сұрақ" },
] as const;

export const CONSULTATION_STATUSES = [
  { value: "new", title: "Новая", tone: "blue" },
  { value: "confirmed", title: "Подтверждена", tone: "amber" },
  { value: "done", title: "Проведена", tone: "green" },
  { value: "cancelled", title: "Отменена", tone: "gray" },
  { value: "no_show", title: "Не пришёл", tone: "red" },
] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number]["value"];
/** Bookings that occupy their slot. */
export const ACTIVE_STATUSES: ConsultationStatus[] = ["new", "confirmed"];

/** Today in Almaty as YYYY-MM-DD and the current hour. */
export function almatyNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

const dayOfWeek = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
export const isWorkday = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && ![0, 6].includes(dayOfWeek(iso));

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Working days a client can pick, starting today (if there is still time) — up to BOOKING_DAYS calendar days. */
export function bookableDays() {
  const now = almatyNow();
  const days: string[] = [];
  for (let i = 0; i <= BOOKING_DAYS; i++) {
    const d = addDays(now.date, i);
    if (!isWorkday(d)) continue;
    if (i === 0 && now.hour >= 18) continue;
    days.push(d);
  }
  return days;
}

/** Is this slot in the future (Almaty time)? */
export function slotInFuture(date: string, time: string) {
  const now = almatyNow();
  if (date > now.date) return true;
  if (date < now.date) return false;
  return Number(time.slice(0, 2)) > now.hour;
}

export function slotValid(date: string, time: string) {
  return isWorkday(date) && (CONSULTATION_SLOTS as readonly string[]).includes(time) && bookableDays().includes(date) && slotInFuture(date, time);
}

/** «+7 777 123 45 67», «87771234567» → «+77771234567», or null. */
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^8(\d{10})$/, "7$1");
  return /^7\d{10}$/.test(d) ? `+${d}` : null;
}

export function formatDayRu(iso: string, locale: "ru" | "kk" = "ru") {
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

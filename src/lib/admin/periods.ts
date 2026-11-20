/** Periods of the «Активность» page (also used by its Excel download). */
export const PERIODS = [
  { value: "today", title: "Сегодня" },
  { value: "yesterday", title: "Вчера" },
  { value: "week", title: "7 дней" },
  { value: "month", title: "Этот месяц" },
  { value: "prev", title: "Прошлый месяц" },
  { value: "all", title: "Всё время" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

export const toPeriod = (v?: string | null): Period => (PERIODS.some((x) => x.value === v) ? (v as Period) : "month");

/** «2026-11-19» from the date picker, or undefined. */
export const toDay = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

/** One Almaty day picked in the calendar: from its midnight to the next one. */
export function dayBounds(day: string) {
  const start = Date.parse(`${day}T00:00:00+05:00`);
  return { from: new Date(start).toISOString(), to: new Date(start + 864e5).toISOString() };
}

/** Period bounds as strings (compare fine with both YYYY-MM-DD and ISO timestamps). `today` = Almaty date. */
export function periodBounds(p: Period, today: string): { from?: string; to?: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const first = (yy: number, mm: number) => `${mm < 1 ? yy - 1 : mm > 12 ? yy + 1 : yy}-${String(((mm + 11) % 12) + 1).padStart(2, "0")}-01`;
  // Day starts at Almaty midnight (UTC+5) as a UTC ISO string, so it compares with timestamps;
  // plain dates compare right too: «2026-11-19» < «2026-11-19T19:00Z» (start of the 20th).
  const dayStart = (offset: number) => new Date(Date.parse(`${today}T00:00:00+05:00`) + offset * 864e5).toISOString();
  if (p === "today") return { from: dayStart(0) };
  if (p === "yesterday") return { from: dayStart(-1), to: dayStart(0) };
  if (p === "week") return { from: new Date(Date.now() - 7 * 864e5).toISOString() };
  if (p === "month") return { from: first(y, m) };
  if (p === "prev") return { from: first(y, m - 1), to: first(y, m) };
  return {};
}

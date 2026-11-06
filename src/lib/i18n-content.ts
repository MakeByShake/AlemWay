import type { LocaleString } from "./types";
import { SHOW_PRICES } from "./prices";

// "за 12 000 ₸", "12 000 ₸", "12000₸" — amounts in tenge written inside admin texts.
const PRICE_IN_TEXT = /\s*(?:за\s+)?\d{1,3}(?:[\s ]\d{3})*\s?₸/g;

/** While prices are hidden, removes tenge amounts from admin texts without touching the stored content. */
function stripPrices(text: string) {
  if (SHOW_PRICES || !text.includes("₸")) return text;
  const out = text.replace(PRICE_IN_TEXT, "").replace(/^[\s,.—-]+/, "").replace(/\s{2,}/g, " ").trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Pick the text for the current language, falling back to Russian. */
export function l(field: LocaleString | undefined | null, locale: string): string {
  if (!field) return "";
  const value = field[locale as keyof LocaleString];
  return stripPrices((value && value.trim()) || field.ru || field.kk || "");
}

/** Split a multiline text field into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatPrice(value: number, locale: string) {
  const n = new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-RU").format(value).replace(/ /g, " ");
  return `${n} ₸`;
}

export const WHATSAPP_DEFAULT = "77080701877";

/** 77778750904 → "+7 777 875 09 04" */
export function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return `+${d}`;
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

export function whatsappLink(number: string | undefined, text?: string) {
  const digits = (number || WHATSAPP_DEFAULT).replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}

export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

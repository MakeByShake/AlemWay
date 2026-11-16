import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { writeClient } from "@/lib/cabinet/server";
import { shareUrl, type ShareKind } from "@/lib/cabinet/share";

/**
 * Data for the team's Google Sheet («Alemway» tab): one row per Germany client, keyed by phone.
 * The Apps Script in the sheet fetches this every 10 minutes and updates only these columns.
 */

export type SheetCell = { v: string; link?: string; bg?: string; color?: string; bold?: boolean };
export type SheetRow = { key: string; cells: Record<string, SheetCell> };

/** Secret part of the export URL (derived from the admin secret, so no extra setting is needed). */
export function sheetKey() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET is not set");
  return createHmac("sha256", s).update("sheet-export-v1").digest("base64url").slice(0, 32);
}
export function checkSheetKey(k: string) {
  const a = Buffer.from(sheetKey());
  const b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STAGE: Record<string, [string, string]> = {
  waiting_data: ["1. Анкета и документы", "#F2F2F2"],
  declaration_ready: ["2. Подпись декана", "#FFF4CC"],
  signed_uploaded: ["3. Проверить и отдать партнёру", "#D6E8FF"],
  sent_partner: ["4. У партнёра, ждём ZAV", "#E8DDFB"],
  zav_received: ["5. ZAV получен", "#D9F2E1"],
  visa_applying: ["6. Подача на визу", "#D9F2E1"],
  visa_received: ["7. Виза есть", "#C6EBD2"],
  done: ["8. Улетел", "#C6EBD2"],
};
const ORDER = Object.keys(STAGE);
const MALE = new Set("merab vadim alan mukhammed nursultan farrukh alisher semyon yelaman мади margulan medeu danial damir aidaulet alikhan adilbek султанбек нурадил taimas ерасыл ansar adilkhan serik elbek nursat ерназар".split(" "));
const FEMALE = new Set("madina raushan ayaulym aiaru amina zhanel darina aisha assel moldir торгын дана назерке эвелина акниет".split(" "));

const de = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join(".") : "");
const digits = (p?: string) => (p ?? "").replace(/\D/g, "").slice(-10);
const phone = (p?: string) => {
  const d = digits(p);
  return d.length === 10 ? `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : (p ?? "");
};
const caps = (s: string) => (s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);

type Row = {
  _id: string;
  number?: number;
  status?: string;
  clientName?: string;
  clientPhone?: string;
  employerName?: string;
  zavReceivedAt?: string;
  dean?: boolean;
  data?: Record<string, string>;
  archivedData?: Record<string, string>;
  files?: Record<string, { path?: string } | null>;
  checks?: string[];
  ai?: { txtfPersonVorname?: string; txtfPersonNachname?: string };
};

export async function sheetRows(base = "https://alemway.kz"): Promise<SheetRow[]> {
  const list = await writeClient().fetch<Row[]>(
    `*[_type == "cabinet" && !(_id in path("drafts.**")) && coalesce(service, "ferienjob") == "ferienjob"] | order(coalesce(number, 0) asc){
      _id, number, status, clientName, clientPhone, employerName, zavReceivedAt, data, archivedData, files,
      "dean": defined(deanIssue) && !defined(deanIssue.resolvedAt), "checks": aiCheck.checks,
      "ai": aiCheck.fields{txtfPersonVorname, txtfPersonNachname}
    }`
  );
  const out: SheetRow[] = [];
  for (const c of list) {
    const d = { ...Object.fromEntries(Object.entries(c.archivedData ?? {}).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(c.data ?? {}).filter(([, v]) => v)) };
    let first = caps((c.ai?.txtfPersonVorname || d.firstName || "").trim());
    let last = caps((c.ai?.txtfPersonNachname || d.lastName || "").trim());
    if (!first && !last) {
      const parts = (c.clientName ?? "").trim().split(/\s+/);
      if (parts.length >= 2) [last, first] = parts;
      else first = parts[0] ?? "";
    }
    if (/^(бла|тест|test)?$/i.test(first) && /^(бла|тест|test)?$/i.test(last)) continue;
    const key = digits(c.clientPhone || d.phone);
    if (key.length < 10) continue;

    const st = c.status ?? "waiting_data";
    const step = Math.max(ORDER.indexOf(st), 0);
    const has = (k: string) => Boolean(c.files?.[k]?.path);
    const link = (k: ShareKind) => (has(k) ? shareUrl(base, c._id, k) : undefined);
    const pno = (c.checks ?? []).join(" ").match(/[Пп]аспорт[^.]{0,20}?\b([A-Z]?\d{7,9})\b/)?.[1] ?? "";

    const sl = last.toLowerCase();
    const fl = first.toLowerCase();
    const sex = /(ova|eva|yeva|ina|kyzy|qyzy|kizi|ова|ева|ина|қызы|кызы)$/.test(sl)
      ? "weiblich"
      : /(ov|ev|yev|in|uly|ul|ugli|ов|ев|ин|ұлы|улы)$/.test(sl)
        ? "männlich"
        : MALE.has(fl)
          ? "männlich"
          : FEMALE.has(fl)
            ? "weiblich"
            : "";

    let lic = (d.driverLicense ?? "").trim();
    lic = /^[BbВв]$/.test(lic) ? "B" : /^(нет|-|i)$/i.test(lic) ? "" : lic;
    if (d.licenseStatus === "none") lic = "Нет";
    else if (d.licenseStatus === "soon" && !has("license")) lic = `получает${d.licenseReady ? ` (${d.licenseReady})` : ""}`;
    else if (!lic && has("license")) lic = "есть";

    const imma: SheetCell = c.dean
      ? { v: "❗ декан не ставит печать", bg: "#FFD8B0", color: "#B54708", bold: true }
      : step >= 2 || has("signed")
        ? { v: "Imma (подписана)", link: link("signed") ?? link("declaration") }
        : has("declaration")
          ? { v: "Imma (ждём подпись)", link: link("declaration") }
          : { v: "" };

    const cells: Record<string, SheetCell> = {
      Vorname: { v: first, bold: true },
      Handynummer: { v: phone(c.clientPhone || d.phone) },
      Familienname: { v: last, bold: true },
      Geschlecht: sex ? { v: sex, bg: sex === "weiblich" ? "#F8D7DA" : "#D6E4F5", color: sex === "weiblich" ? "#9B1C31" : "#1F4E9C" } : { v: "" },
      Empfang: { v: "Казахстан", bg: "#D6E4F5", color: "#1F4E9C" },
      "Bescheinigung Uebersetzung": { v: has("enrollment") ? "Справка EN" : "", link: link("enrollment") },
      Arbeitgeber: { v: c.employerName ?? "" },
      "Ferien ab": { v: de(d.breakFrom) },
      "Ferien bis": { v: de(d.breakTo) },
      "Текущий уровень": { v: STAGE[st]?.[0] ?? st, bg: STAGE[st]?.[1] },
      Passnummer: { v: pno },
      Geburstdatum: { v: de(d.birthDate) },
      Reisepass: { v: has("passport") ? (pno ? `Reisepass ${pno}` : "Reisepass") : "", link: link("passport") },
      Führerschein: { v: lic, link: link("license") },
      "Bescheinigung Original": { v: has("enrollment") ? "Справка" : "", link: link("enrollment") },
      Imma: imma,
      ZAV: step >= 4 ? { v: `✓ ${de(c.zavReceivedAt)}`.trim(), link: link("zav"), color: "#0A7A42", bold: true } : { v: "" },
    };
    out.push({ key, cells });
  }
  return out;
}


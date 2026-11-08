import clsx from "clsx";
import type { ReactNode } from "react";
import { serviceOf } from "@/lib/cabinet/fields";

/** Server-safe pieces of the admin pages. */

const TONES = {
  blue: "bg-brand-soft text-brand",
  amber: "bg-warn-soft text-warn",
  green: "bg-accent-soft text-[#0a7a42]",
  gray: "bg-surface text-muted",
  red: "bg-red-50 text-red-700",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap", TONES[tone])}>{children}</span>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-[26px] font-bold sm:text-[30px]">{title}</h1>
      {children}
    </div>
  );
}

export function FilterTabs({ base, current, items, param = "status" }: { base: string; current?: string; items: { value: string; title: string }[]; param?: string }) {
  const all = [{ value: "", title: "Все" }, ...items];
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {all.map((i) => (
        <a
          key={i.value || "all"}
          href={i.value ? `${base}?${param}=${i.value}` : base}
          className={clsx(
            "rounded-full border px-3.5 py-1.5 text-[14px] font-medium",
            (current ?? "") === i.value ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"
          )}
        >
          {i.title}
        </a>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-8 text-center text-[15px] text-muted">{children}</div>;
}

export function fmtDate(iso?: string | null, withTime = true) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime && iso.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function waLink(phone?: string) {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^8(\d{10})$/, "7$1");
  return d.length >= 11 ? `https://wa.me/${d}` : null;
}

/** Where the client is in the process — the same steps the client sees in the cabinet. */
export function clientProgress(service: string | undefined, status: string | undefined): { step: number; total: number; label: string; tone: Tone } {
  const st = status ?? "waiting_data";
  if (serviceOf(service) === "keta") {
    const map: Record<string, [number, string, Tone]> = {
      waiting_data: [1, "Заполняет анкету", "amber"],
      keta_applying: [2, "Данные получены — подать K-ETA", "blue"],
      keta_applied: [2, "Подано — ждём решения", "amber"],
      keta_approved: [3, "Одобрено ✅", "green"],
      keta_rejected: [3, "Отказ", "red"],
      done: [3, "Завершено ✅", "green"],
    };
    const [step, label, tone] = map[st] ?? map.waiting_data;
    return { step, total: 3, label, tone };
  }
  const map: Record<string, [number, string, Tone]> = {
    waiting_data: [1, "Заполняет анкету", "amber"],
    declaration_ready: [2, "Подпись в деканате", "amber"],
    signed_uploaded: [3, "Готово ✅ — передать работодателю", "green"],
    zav_received: [3, "ZAV получен ✅", "green"],
    done: [3, "Завершено ✅", "green"],
  };
  const [step, label, tone] = map[st] ?? map.waiting_data;
  return { step, total: 3, label, tone };
}

export function Progress({ service, status }: { service?: string; status?: string }) {
  const p = clientProgress(service, status);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: p.total }, (_, i) => (
          <span key={i} className={clsx("h-1.5 w-5 rounded-full", i < p.step ? (p.tone === "green" ? "bg-accent" : p.tone === "red" ? "bg-red-500" : "bg-brand") : "bg-line")} />
        ))}
      </div>
      <Badge tone={p.tone}>{p.label}</Badge>
    </div>
  );
}

export const SERVICE_SHORT: Record<string, string> = { ferienjob: "🇩🇪 Германия", keta: "🇰🇷 K-ETA" };

import Link from "next/link";
import { ACTIVITY_ICONS, type Activity } from "@/lib/admin/activity";

/** «2 мин назад», «3 ч назад», «вчера в 14:05», «05.11 в 10:20» (Almaty time). */
export function timeAgo(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  if (min < 60 * 6) return `${Math.floor(min / 60)} ч назад`;
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", ...o }).format(d);
  const day = (x: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", dateStyle: "short" }).format(x);
  const time = fmt({ hour: "2-digit", minute: "2-digit" });
  if (day(d) === day(new Date())) return `сегодня в ${time}`;
  if (day(d) === day(new Date(Date.now() - 864e5))) return `вчера в ${time}`;
  return `${fmt({ day: "2-digit", month: "2-digit" })} в ${time}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const AVATAR_COLORS = ["bg-brand-soft text-brand", "bg-accent-soft text-accent", "bg-warn-soft text-warn", "bg-surface text-ink"];
export const avatarColor = (login: string) => AVATAR_COLORS[[...login].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function ActivityFeed({ items, names, showClient = true }: { items: Activity[]; names: Record<string, string>; showClient?: boolean }) {
  if (!items.length) return <p className="text-[14px] text-muted">Пока пусто — действия команды появятся здесь.</p>;
  return (
    <ol className="relative grid gap-3 border-l border-line pl-5">
      {items.map((a) => {
        const name = names[a.login] ?? a.name ?? a.login;
        return (
          <li key={a._id} className="relative">
            <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] ring-1 ring-line" aria-hidden>
              {ACTIVITY_ICONS[a.kind] ?? "•"}
            </span>
            <p className="text-[14px] leading-snug">
              <b>{name}</b> {a.text}
              {showClient && a.cabinet && a.client && (
                <>
                  {" · "}
                  <Link prefetch={false} href={`/admin/clients/${a.cabinet}`} className="font-medium text-brand hover:underline">
                    {a.client}
                  </Link>
                </>
              )}
            </p>
            <p className="text-[12.5px] text-muted">{timeAgo(a.at)}</p>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, CalendarClock, Home, Inbox, MessageSquare, PenSquare, Users, UserCog, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Главная", icon: Home },
  { href: "/admin/leads", label: "Заявки", icon: Inbox },
  { href: "/admin/clients", label: "Клиенты", icon: Users },
  { href: "/admin/consultations", label: "Консультации", icon: CalendarClock },
  { href: "/admin/activity", label: "Активность", icon: Activity, fullOnly: true },
  { href: "/admin/finance", label: "Финансы", icon: Wallet, ownerOnly: true },
  { href: "/admin/feedback", label: "Отзывы", icon: MessageSquare },
  { href: "/admin/team", label: "Команда", icon: UserCog },
];

export function AdminNav({ owner, full }: { owner: boolean; full: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {ITEMS.filter((i) => (owner || !("ownerOnly" in i)) && (full || !("fullOnly" in i))).map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium",
              active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface"
            )}
          >
            <Icon className="h-[18px] w-[18px]" /> {label}
          </Link>
        );
      })}
      {owner && (
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- the Studio is a separate app
        <a href="/studio" className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium text-muted hover:bg-surface">
          <PenSquare className="h-[18px] w-[18px]" /> Тексты сайта
        </a>
      )}
    </nav>
  );
}

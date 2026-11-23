"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useListQuery } from "./ListMemory";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, Building2, CalendarClock, Home, Inbox, MessageSquare, MessagesSquare, PenSquare, Users, UserCog, Wallet } from "lucide-react";
import { useLive } from "@/components/chat/live";
import { loadInbox, useInbox } from "./chat/inbox";

const ITEMS = [
  { href: "/admin", label: "Главная", icon: Home },
  { href: "/admin/leads", label: "Заявки", icon: Inbox },
  { href: "/admin/clients", label: "Клиенты", icon: Users },
  { href: "/admin/chats", label: "Чаты", icon: MessagesSquare },
  { href: "/admin/employers", label: "Работодатели", icon: Building2 },
  { href: "/admin/consultations", label: "Консультации", icon: CalendarClock },
  { href: "/admin/activity", label: "Активность", icon: Activity, fullOnly: true },
  { href: "/admin/finance", label: "Финансы", icon: Wallet, ownerOnly: true },
  { href: "/admin/feedback", label: "Отзывы", icon: MessageSquare },
  { href: "/admin/team", label: "Команда", icon: UserCog },
];

/** The team's list of chats changed on the server: the counter and whoever shows the list reload. */
const inboxChanged = () => void loadInbox(true);

export function AdminNav({ owner, full }: { owner: boolean; full: boolean }) {
  const path = usePathname();
  // The number on «Чаты»: how many clients wait for a person. Nothing rings or pops up — the team looks here.
  const inbox = useInbox();
  useEffect(() => {
    void loadInbox();
  }, []);
  useLive(inbox.live, inboxChanged, path.startsWith("/admin/chats") ? 8_000 : 60_000);
  // On a phone the menu is one scrolling row: bring the open section into view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = nav.current;
    const el = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !el || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += el.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - el.clientWidth) / 2;
  }, [path]);
  // Lists open with the filters they had last time (from a card or another section).
  const remembered: Record<string, string> = { "/admin/clients": useListQuery("/admin/clients"), "/admin/employers": useListQuery("/admin/employers") };
  return (
    <nav ref={nav} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {ITEMS.filter((i) => (owner || !("ownerOnly" in i)) && (full || !("fullOnly" in i))).map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link prefetch={false}
            key={href}
            aria-current={active ? "page" : undefined}
            href={path !== href && remembered[href] ? `${href}${remembered[href]}` : href}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-medium",
              active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface"
            )}
          >
            <Icon className="h-[18px] w-[18px]" /> {label}
            {href === "/admin/chats" && inbox.waiting > 0 && (
              <span className="min-w-5 rounded-full bg-orange-500 px-1.5 text-center text-[12px] leading-5 font-bold text-white lg:ml-auto" title="Ждут ответа человека">
                {inbox.waiting}
              </span>
            )}
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

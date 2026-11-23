import Link from "next/link";
import { MessageCircle } from "lucide-react";

const TEXT = {
  ru: {
    title: "Чат с AlemWay",
    sub: "Вопросы по документам, связь с куратором и новости по вашему делу. Всё в одном месте.",
    open: "Открыть чат",
    unread: "Новых сообщений",
    last: "Последнее сообщение",
  },
  kk: {
    title: "AlemWay чаты",
    sub: "Құжаттар бойынша сұрақтар, куратормен байланыс және ісіңіз бойынша жаңалықтар. Бәрі бір жерде.",
    open: "Чатты ашу",
    unread: "Жаңа хабарлама",
    last: "Соңғы хабарлама",
  },
};

/** The way into the chat from the cabinet: a card on the page and a round button that stays on screen. */
export function ChatEntry({ locale, unread, last }: { locale: "ru" | "kk"; unread: number; last?: string | null }) {
  const t = TEXT[locale];
  const href = `/${locale}/cabinet/chat`;
  return (
    <>
      <section className="container-x pb-6">
        <div className="card mx-auto flex max-w-3xl flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[20px] font-bold">
              <MessageCircle className="h-6 w-6 text-brand" /> {t.title}
              {unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[13px] font-bold text-white">{unread}</span>}
            </h2>
            {unread > 0 && last ? (
              <p className="mt-1 line-clamp-2 text-[15px] text-ink">
                <span className="text-muted">{t.last}: </span>
                {last}
              </p>
            ) : (
              <p className="mt-1 text-[14px] text-muted">{t.sub}</p>
            )}
          </div>
          <Link prefetch={false} href={href} className="btn-primary shrink-0">
            {t.open}
          </Link>
        </div>
      </section>
      <Link
        prefetch={false}
        href={href}
        aria-label={unread > 0 ? `${t.open}. ${t.unread}: ${unread}` : t.open}
        className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_30px_-8px_rgba(35,64,255,0.6)] transition-transform hover:scale-105 lg:right-8 lg:bottom-8"
      >
        <MessageCircle className="h-7 w-7" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[12px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
    </>
  );
}

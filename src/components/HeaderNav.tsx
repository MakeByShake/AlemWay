"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { SanityImage } from "@/lib/types";
import { Flag } from "./Flag";
import { Logo } from "./Logo";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

export type NavGroup = {
  title: string;
  items: { title: string; slug: string; countryCode?: string; flagImage?: SanityImage }[];
};

const LOCALE_LABEL: Record<string, string> = { ru: "RU", kk: "KZ" };

function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <div className={`flex items-center rounded-[10px] border border-line p-0.5 text-[13px] font-semibold ${className}`} role="group" aria-label={t("language")}>
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          aria-current={loc === locale ? "true" : undefined}
          className={`rounded-[8px] px-2.5 py-1.5 transition-colors ${loc === locale ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
        >
          {LOCALE_LABEL[loc]}
        </Link>
      ))}
    </div>
  );
}

export function HeaderNav({ groups, whatsappHref }: { groups: NavGroup[]; whatsappHref: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation (state adjusted during render, no effect needed).
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setMenuOpen(false);
    setDropOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!dropOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDropOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropOpen]);

  const linkCls = "rounded-lg px-3 py-2 text-[15px] font-medium text-ink/80 transition-colors hover:text-ink";

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur-sm">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        {t("skip")}
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link href="/" className="shrink-0" aria-label={`AlemWay Visa — ${t("home")}`}>
          <Logo className="h-[26px] w-auto sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              className={`${linkCls} inline-flex items-center gap-1`}
              aria-expanded={dropOpen}
              aria-haspopup="true"
              onClick={() => setDropOpen((v) => !v)}
            >
              {t("services")}
              <ChevronDown className={`h-4 w-4 transition-transform ${dropOpen ? "rotate-180" : ""}`} />
            </button>
            {dropOpen && (
              <div className="absolute top-full left-1/2 mt-2 w-[min(640px,90vw)] -translate-x-1/2 rounded-2xl border border-line bg-white p-5 shadow-[0_16px_48px_-12px_rgba(11,15,36,0.18)]">
                <div className="grid gap-5 sm:grid-cols-2">
                  {groups.map((g) => (
                    <div key={g.title}>
                      <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{g.title}</p>
                      <ul className="space-y-0.5">
                        {g.items.map((item) => (
                          <li key={item.slug}>
                            <Link
                              href={`/services/${item.slug}`}
                              className="flex items-center gap-3 rounded-[10px] px-2 py-2 text-[15px] font-medium hover:bg-surface"
                            >
                              <Flag code={item.countryCode} image={item.flagImage} className="h-4 w-6" />
                              {item.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-line pt-3">
                  <Link href="/services" className="text-[14px] font-semibold text-brand hover:underline">
                    {t("allServices")} →
                  </Link>
                </div>
              </div>
            )}
          </div>
          <Link href="/about" className={linkCls}>
            {t("about")}
          </Link>
          <Link href="/contacts" className={linkCls}>
            {t("contacts")}
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher />
          <WhatsAppLink href={whatsappHref} place="header" className="btn-whatsapp min-h-11 px-4 text-[14px]">
            <WhatsAppIcon className="h-[18px] w-[18px]" />
            {t("whatsapp")}
          </WhatsAppLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-line"
            aria-label={menuOpen ? t("close") : t("menu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-white lg:hidden">
          <nav className="container-x flex flex-col gap-6 py-6" aria-label="Mobile">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{g.title}</p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.slug}>
                      <Link href={`/services/${item.slug}`} className="flex items-center gap-3 border-b border-line py-3.5 text-[17px] font-medium">
                        <Flag code={item.countryCode} image={item.flagImage} className="h-4 w-6" />
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-col">
              <Link href="/services" className="border-b border-line py-3.5 text-[17px] font-semibold">
                {t("allServices")}
              </Link>
              <Link href="/about" className="border-b border-line py-3.5 text-[17px] font-semibold">
                {t("about")}
              </Link>
              <Link href="/contacts" className="border-b border-line py-3.5 text-[17px] font-semibold">
                {t("contacts")}
              </Link>
            </div>
            <WhatsAppLink href={whatsappHref} place="mobile_menu" className="btn-whatsapp w-full">
              <WhatsAppIcon />
              {t("whatsapp")}
            </WhatsAppLink>
          </nav>
        </div>
      )}
    </header>
  );
}

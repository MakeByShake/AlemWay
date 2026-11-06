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

function LanguageSwitcher({ className = "", light = false }: { className?: string; light?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <div className={`flex items-center rounded-[10px] border p-0.5 text-[13px] font-semibold transition-colors ${light ? "border-white/25" : "border-line"} ${className}`} role="group" aria-label={t("language")}>
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          aria-current={loc === locale ? "true" : undefined}
          className={`rounded-[8px] px-2.5 py-1.5 transition-colors ${
            loc === locale ? (light ? "bg-white text-ink" : "bg-ink text-white") : light ? "text-white/75 hover:text-white" : "text-muted hover:text-ink"
          }`}
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
  const headerRef = useRef<HTMLElement>(null);

  // Home page: the header floats transparent over the hero photo and turns white when the pointer
  // comes near the top, the page is scrolled, a menu is open or focus is inside the header.
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [pointerNear, setPointerNear] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const h = headerRef.current?.offsetHeight ?? 72;
      setPointerNear(e.clientY < h + 48);
    };
    const onLeave = () => setPointerNear(false);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [overlay]);

  const transparent = overlay && !scrolled && !pointerNear && !focusInside && !menuOpen && !dropOpen;

  // Close menus on navigation (state adjusted during render, no effect needed).
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setMenuOpen(false);
    setDropOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    // Rotating a tablet to landscape shows the desktop menu — close the mobile one.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => mq.matches && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

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

  const linkCls = `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${transparent ? "text-white/85 hover:text-white" : "text-ink/80 hover:text-ink"}`;

  return (
    <>
    <header
      ref={headerRef}
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocusInside(false)}
      className={`top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ${overlay ? "fixed inset-x-0" : "sticky"} ${
        transparent ? "border-transparent bg-transparent" : "border-line/80 bg-white/95 backdrop-blur-sm"
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        {t("skip")}
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link href="/" className="shrink-0" aria-label={`AlemWay Visa — ${t("home")}`}>
          <Logo variant={transparent ? "white" : "color"} className="h-[26px] w-auto sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <Link href="/" className={`${linkCls} ${pathname === "/" ? (transparent ? "text-white" : "text-ink") : ""}`} aria-current={pathname === "/" ? "page" : undefined}>
            {t("home")}
          </Link>
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
          <Link href="/feedback" className={linkCls}>
            {t("feedback")}
          </Link>
          <Link href="/contacts" className={linkCls}>
            {t("contacts")}
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher light={transparent} />
          <WhatsAppLink href={whatsappHref} place="header" className="btn-whatsapp min-h-11 px-4 text-[14px]">
            <WhatsAppIcon className="h-[18px] w-[18px]" />
            <span className="xl:hidden">{t("whatsappShort")}</span>
            <span className="hidden xl:inline">{t("whatsapp")}</span>
          </WhatsAppLink>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher light={transparent} />
          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-[10px] border transition-colors ${transparent ? "border-white/25 text-white" : "border-line"}`}
            aria-label={menuOpen ? t("close") : t("menu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

    </header>

      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto overscroll-contain border-t border-line bg-white lg:hidden">
          <nav className="container-x flex flex-col gap-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" aria-label="Mobile" onClick={(e) => (e.target as HTMLElement).closest("a") && closeMenu()}>
            <Link href="/" className="-mb-2 border-b border-line pb-3.5 text-[17px] font-semibold">
              {t("home")}
            </Link>
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
              <Link href="/feedback" className="border-b border-line py-3.5 text-[17px] font-semibold">
                {t("feedback")}
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
    </>
  );
}

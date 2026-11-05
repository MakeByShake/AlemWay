"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import type { SanityImage } from "@/lib/types";
import { Flag } from "./Flag";

export type HeroServiceItem = {
  slug: string;
  title: string;
  label: string;
  countryCode?: string;
  flagImage?: SanityImage;
  features: string[];
  duration: string;
};

type Labels = { prev: string; next: string; cta: string; region: string; slide: string };

/** Swipeable white cards in the hero: every service, the popular one first. Native scroll-snap — works with touch, trackpad and keys. */
export function HeroServices({ items, labels }: { items: HeroServiceItem[]; labels: Labels }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }, [items.length]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!items.length) return null;
  const many = items.length > 1;

  return (
    <section aria-roledescription="carousel" aria-label={labels.region} className="relative w-full max-w-[520px] justify-self-center lg:justify-self-end">
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          goTo(index + (e.key === "ArrowRight" ? 1 : -1));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[22px] [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white [&::-webkit-scrollbar]:hidden"
      >
        {items.map((s, i) => (
          <div
            key={s.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${labels.slide} ${i + 1} / ${items.length}: ${s.title}`}
            className="w-full shrink-0 snap-start snap-always"
          >
            <article className="flex h-full flex-col rounded-[22px] bg-white p-5 text-ink sm:p-6">
              <div className="flex items-center gap-3">
                <Flag code={s.countryCode} image={s.flagImage} className="h-6 w-9" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{s.label}</p>
                  <p className="truncate text-[17px] font-bold tracking-[-0.015em]">{s.title}</p>
                </div>
              </div>

              {s.features.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {s.features.map((f) => (
                    <li key={f} className="flex gap-2.5 py-2.5 text-[14px] leading-snug">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-4">
                {s.duration && (
                  <p className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {s.duration}
                  </p>
                )}
                <Link href={`/services/${s.slug}`} className="btn-primary mt-4 w-full" tabIndex={i === index ? 0 : -1}>
                  {labels.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </div>
        ))}
      </div>

      {many && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" role="tablist" aria-label={labels.region}>
            {items.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
                onClick={() => goTo(i)}
                className={clsx("h-2 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label={labels.prev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-35"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === items.length - 1}
              aria-label={labels.next}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-35"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

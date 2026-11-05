import { ArrowUpRight, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice, l } from "@/lib/i18n-content";
import { SHOW_PRICES } from "@/lib/prices";
import type { Service } from "@/lib/types";
import { hasImage } from "@/sanity/image";
import { Flag } from "./Flag";
import { Media } from "./Media";

export async function ServiceCard({ service, locale, showCategory = false }: { service: Service; locale: string; showCategory?: boolean }) {
  const t = await getTranslations("service");
  const title = l(service.title, locale);
  const badge = l(service.badge, locale);
  const duration = l(service.duration, locale);
  const hasPrice = !service.priceOnRequest && typeof service.price === "number";
  const withCover = hasImage(service.coverImage);

  return (
    <Link
      href={`/services/${service.slug.current}`}
      className="group card flex h-full flex-col overflow-hidden transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-[0_16px_40px_-18px_rgba(11,15,36,0.3)]"
    >
      {withCover ? (
        <div className="relative">
          <Media
            image={service.coverImage}
            locale={locale}
            placeholder=""
            alt=""
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.03]"
            width={900}
            hideCredit
          />
          <Flag code={service.countryCode} image={service.flagImage} className="absolute bottom-3 left-3 h-6 w-9 shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-2 ring-white" />
          {badge && (
            <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-brand shadow-sm">{badge}</span>
          )}
          <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm transition-colors group-hover:bg-brand group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <Flag code={service.countryCode} image={service.flagImage} className="h-7 w-10" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {showCategory && service.category && (
          <p className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{l(service.category.title, locale)}</p>
        )}
        <h3 className={`h-card ${showCategory && service.category ? "mt-1.5" : ""}`}>{title}</h3>
        {badge && !withCover && (
          <span className="mt-2 inline-flex w-fit rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">{badge}</span>
        )}
        {l(service.excerpt, locale) && <p className="mt-2 text-[15px] leading-relaxed text-muted">{l(service.excerpt, locale)}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-5">
          {SHOW_PRICES && (
            <p className="text-[19px] font-bold tracking-[-0.02em] text-brand">
              {hasPrice ? formatPrice(service.price!, locale) : <span className="text-[15px] font-semibold text-ink/70">{t("priceOnRequest")}</span>}
            </p>
          )}
          {duration && (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Clock className="h-3.5 w-3.5" /> {duration}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

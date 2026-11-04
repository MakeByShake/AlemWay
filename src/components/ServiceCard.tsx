import { ArrowUpRight, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice, l } from "@/lib/i18n-content";
import type { Service } from "@/lib/types";
import { Flag } from "./Flag";

export async function ServiceCard({ service, locale, showCategory = false }: { service: Service; locale: string; showCategory?: boolean }) {
  const t = await getTranslations("service");
  const title = l(service.title, locale);
  const badge = l(service.badge, locale);
  const duration = l(service.duration, locale);
  const hasPrice = !service.priceOnRequest && typeof service.price === "number";

  return (
    <Link
      href={`/services/${service.slug.current}`}
      className="group card flex h-full flex-col p-5 transition-[box-shadow,border-color] duration-200 hover:border-ink/15 hover:shadow-[0_12px_32px_-16px_rgba(11,15,36,0.22)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <Flag code={service.countryCode} image={service.flagImage} className="h-7 w-10" />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      {showCategory && service.category && (
        <p className="mt-5 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">{l(service.category.title, locale)}</p>
      )}
      <h3 className={`h-card ${showCategory && service.category ? "mt-1.5" : "mt-5"}`}>{title}</h3>
      {badge && (
        <span className="mt-2 inline-flex w-fit rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">{badge}</span>
      )}
      {l(service.excerpt, locale) && <p className="mt-2 text-[15px] leading-relaxed text-muted">{l(service.excerpt, locale)}</p>}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-5">
        <p className="text-[17px] font-bold tracking-[-0.01em]">
          {hasPrice ? formatPrice(service.price!, locale) : <span className="text-[15px] font-semibold text-ink/70">{t("priceOnRequest")}</span>}
        </p>
        {duration && (
          <p className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <Clock className="h-3.5 w-3.5" /> {duration}
          </p>
        )}
      </div>
    </Link>
  );
}

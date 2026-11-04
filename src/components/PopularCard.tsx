import { ArrowRight, Check, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice, l } from "@/lib/i18n-content";
import type { FeaturesBlock, Service } from "@/lib/types";
import { Flag } from "./Flag";

/** White card in the hero: the most popular service with price and what's included. */
export async function PopularCard({ service, locale }: { service: Service; locale: string }) {
  const [t, ts] = await Promise.all([getTranslations("hero"), getTranslations("service")]);
  const features = (service.blocks ?? []).find((b): b is FeaturesBlock => b._type === "features")?.items?.slice(0, 4) ?? [];
  const hasPrice = !service.priceOnRequest && typeof service.price === "number";
  const duration = l(service.duration, locale);

  return (
    <div className="rounded-[22px] bg-white p-5 text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Flag code={service.countryCode} image={service.flagImage} className="h-6 w-9" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{t("popular")}</p>
            <p className="text-[17px] font-bold tracking-[-0.015em]">{l(service.title, locale)}</p>
          </div>
        </div>
      </div>

      {features.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {features.map((f) => (
            <li key={f._key} className="flex gap-2.5 py-3 text-[14px] leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
              {l(f, locale)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">{ts("price")}</p>
          <p className="text-[34px] leading-none font-extrabold tracking-[-0.04em] text-brand">
            {hasPrice ? formatPrice(service.price!, locale) : <span className="text-xl">{ts("priceOnRequest")}</span>}
          </p>
        </div>
        {duration && (
          <p className="flex max-w-[48%] items-start gap-1.5 text-right text-[12px] leading-snug text-muted">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {duration}
          </p>
        )}
      </div>

      <Link href={`/services/${service.slug.current}`} className="btn-primary mt-5 w-full">
        {t("cardCta")} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

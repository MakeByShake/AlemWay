import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getService, getServices, getSettings } from "@/lib/data";
import { formatPrice, l, siteUrl, whatsappLink } from "@/lib/i18n-content";
import { SHOW_PRICES } from "@/lib/prices";
import { pageMetadata } from "@/lib/seo";
import type { FaqBlock, Service } from "@/lib/types";
import { hasImage, imageUrl } from "@/sanity/image";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Flag } from "@/components/Flag";
import { PhotoCredit } from "@/components/Media";
import { JsonLd } from "@/components/JsonLd";
import { LeadSection, SectionHeading } from "@/components/Sections";
import { ServiceCard } from "@/components/ServiceCard";
import { TrackServiceOpen } from "@/components/TrackServiceOpen";
import { WhatsAppIcon, WhatsAppLink } from "@/components/WhatsAppLink";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const services = await getServices();
  return services.map((s) => ({ slug: s.slug.current }));
}

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await getService(slug);
  if (!service) return {};
  const title = l(service.seo?.title, locale) || l(service.title, locale);
  return pageMetadata({
    locale,
    path: `/services/${slug}`,
    title,
    description: l(service.seo?.description, locale) || l(service.excerpt, locale),
    image: hasImage(service.seo?.image)
      ? imageUrl(service.seo!.image!, 1200, 630)
      : service.coverImage?.src
        ? `${siteUrl()}${service.coverImage.src}`
        : hasImage(service.coverImage)
          ? imageUrl(service.coverImage, 1200, 630)
          : undefined,
    absoluteTitle: Boolean(l(service.seo?.title, locale)),
  });
}

function relatedFor(service: Service, all: Service[]) {
  const others = all.filter((s) => s._id !== service._id);
  const same = others.filter((s) => s.category?._id && s.category._id === service.category?._id);
  return [...same, ...others.filter((s) => !same.includes(s))].slice(0, 3);
}

export default async function ServicePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [service, all, settings, t] = await Promise.all([getService(slug), getServices(), getSettings(), getTranslations("service")]);
  if (!service) notFound();

  const title = l(service.title, locale);
  const excerpt = l(service.excerpt, locale);
  const duration = l(service.duration, locale);
  const hasPrice = SHOW_PRICES && !service.priceOnRequest && typeof service.price === "number";
  const wa = whatsappLink(settings.whatsapp, l(service.whatsappText, locale) || undefined);
  const related = relatedFor(service, all);
  const url = `${siteUrl()}/${locale}/services/${slug}`;
  const cover = hasImage(service.coverImage) ? service.coverImage : null;

  const faqItems = (service.blocks ?? [])
    .filter((b): b is FaqBlock => b._type === "faq")
    .flatMap((b) => b.items ?? [])
    .map((q) => ({ q: l(q.question, locale), a: l(q.answer, locale) }))
    .filter((q) => q.q && q.a && !q.a.includes("TODO"));

  return (
    <>
      <TrackServiceOpen slug={slug} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: title,
          description: excerpt,
          url,
          areaServed: "KZ",
          provider: { "@type": "TravelAgency", name: "AlemWay Visa", url: siteUrl(), telephone: settings.phone },
          ...(hasPrice ? { offers: { "@type": "Offer", price: service.price, priceCurrency: "KZT" } } : {}),
        }}
      />
      {faqItems.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }}
        />
      )}

      {/* Service header */}
      <section className={`relative isolate overflow-hidden ${cover ? "bg-ink text-white" : "border-b border-line bg-surface"}`}>
        {cover && (
          <>
            <Image src={imageUrl(cover, 1920)} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
            <div
              className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,15,36,0.9),rgba(11,15,36,0.6)_55%,rgba(11,15,36,0.3)),linear-gradient(180deg,rgba(11,15,36,0.15),rgba(11,15,36,0.8))]"
              aria-hidden
            />
            <PhotoCredit credit={cover.credit} />
          </>
        )}
        <div className={`container-x ${cover ? "py-10 sm:py-20" : "py-8 sm:py-14"}`}>
          <Link href="/services" className={`inline-flex items-center gap-1.5 text-[14px] font-medium ${cover ? "text-white/70 hover:text-white" : "text-muted hover:text-ink"}`}>
            <ArrowLeft className="h-4 w-4" /> {t("back")}
          </Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-14">
            <div>
              <div className="flex items-center gap-3">
                <Flag code={service.countryCode} image={service.flagImage} className="h-8 w-12" label={title} />
                {service.category && <span className={`text-[14px] font-semibold ${cover ? "text-white/70" : "text-muted"}`}>{l(service.category.title, locale)}</span>}
                {l(service.badge, locale) && (
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">{l(service.badge, locale)}</span>
                )}
              </div>
              <h1 className="h-display mt-5 text-balance">{title}</h1>
              {excerpt && <p className={`mt-4 max-w-2xl text-[17px] leading-relaxed sm:text-lg ${cover ? "text-white/80" : "text-muted"}`}>{excerpt}</p>}
            </div>

            <div className="card p-5 text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] sm:p-6">
              <div className="grid grid-cols-2 gap-4">
                {SHOW_PRICES && (
                  <div>
                    <p className="text-[13px] text-muted">{t("price")}</p>
                    <p className="mt-1 text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-brand">
                      {hasPrice ? formatPrice(service.price!, locale) : <span className="text-[17px]">{t("priceOnRequest")}</span>}
                    </p>
                  </div>
                )}
                {duration && (
                  <div>
                    <p className="text-[13px] text-muted">{t("duration")}</p>
                    <p className="mt-1 flex gap-1.5 text-[15px] leading-snug font-semibold">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      {duration}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <a href="#lead" className="btn-primary">
                  {t("leaveRequest")}
                </a>
                <WhatsAppLink href={wa} place="service_header" className="btn-whatsapp">
                  <WhatsAppIcon /> {t("whatsapp")}
                </WhatsAppLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {service.blocks?.length ? (
        <div className="container-x py-14 sm:py-20">
          <div className="max-w-3xl">
            <BlockRenderer blocks={service.blocks} ctx={{ locale, whatsappHref: wa }} />
          </div>
        </div>
      ) : null}

      <LeadSection
        locale={locale}
        defaultService={slug}
        whatsappText={l(service.whatsappText, locale) || undefined}
        title={t("requestTitle")}
        subtitle={t("requestSubtitle")}
      />

      {related.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-x">
            <SectionHeading title={t("related")} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <ServiceCard key={s._id} service={s} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

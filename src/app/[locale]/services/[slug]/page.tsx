import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getService, getServices, getSettings } from "@/lib/data";
import { formatPrice, l, siteUrl, whatsappLink } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import type { FaqBlock, Service } from "@/lib/types";
import { hasImage, urlFor } from "@/sanity/image";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Flag } from "@/components/Flag";
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
    image: hasImage(service.seo?.image) ? urlFor(service.seo!.image!).width(1200).height(630).url() : undefined,
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
  const hasPrice = !service.priceOnRequest && typeof service.price === "number";
  const wa = whatsappLink(settings.whatsapp, l(service.whatsappText, locale) || undefined);
  const related = relatedFor(service, all);
  const url = `${siteUrl()}/${locale}/services/${slug}`;

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
      <section className="border-b border-line bg-surface">
        <div className="container-x py-8 sm:py-14">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {t("back")}
          </Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-14">
            <div>
              <div className="flex items-center gap-3">
                <Flag code={service.countryCode} image={service.flagImage} className="h-8 w-12" label={title} />
                {service.category && <span className="text-[14px] font-semibold text-muted">{l(service.category.title, locale)}</span>}
              </div>
              <h1 className="h-display mt-5 text-balance">{title}</h1>
              {excerpt && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-lg">{excerpt}</p>}
            </div>

            <div className="card p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[13px] text-muted">{t("price")}</p>
                  <p className="mt-1 text-[24px] leading-tight font-bold tracking-[-0.03em]">
                    {hasPrice ? formatPrice(service.price!, locale) : <span className="text-[17px]">{t("priceOnRequest")}</span>}
                  </p>
                </div>
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

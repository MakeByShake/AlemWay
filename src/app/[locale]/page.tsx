import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowDown, Star } from "lucide-react";
import { getFaq, getReviews, getServicesByCategory, getSettings } from "@/lib/data";
import { l, siteUrl, whatsappLink } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { Media } from "@/components/Media";
import { ServiceCard } from "@/components/ServiceCard";
import { FaqList, LeadSection, SectionHeading } from "@/components/Sections";
import { WhatsAppIcon, WhatsAppLink } from "@/components/WhatsAppLink";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const s = await getSettings();
  return pageMetadata({
    locale,
    path: "",
    title: t("homeTitle"),
    description: l(s.seoDescription, locale) || t("homeDescription"),
    absoluteTitle: true,
  });
}

type HowStep = { title: string; text: string };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [settings, groups, reviews, faq, t, th, tn] = await Promise.all([
    getSettings(),
    getServicesByCategory(),
    getReviews(),
    getFaq(),
    getTranslations("home"),
    getTranslations("hero"),
    getTranslations("nav"),
  ]);
  const how = t.raw("how") as HowStep[];
  const wa = whatsappLink(settings.whatsapp);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TravelAgency",
          name: "AlemWay Visa",
          url: `${siteUrl()}/${locale}`,
          logo: `${siteUrl()}/brand/alemway_icon.png`,
          image: `${siteUrl()}/og-default.png`,
          telephone: settings.phone,
          email: settings.email,
          foundingDate: "2018",
          address: { "@type": "PostalAddress", addressLocality: "Almaty", addressCountry: "KZ" },
          areaServed: "KZ",
          sameAs: settings.instagram ? [`https://instagram.com/${settings.instagram}`] : undefined,
        }}
      />

      {/* Hero */}
      <section className="overflow-hidden">
        <div className="container-x grid gap-10 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pt-20 lg:pb-24">
          <div>
            <p className="eyebrow">{th("eyebrow")}</p>
            <h1 className="h-display mt-4 max-w-[14ch] text-balance">{l(settings.heroTitle, locale)}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted sm:text-lg">{l(settings.heroSubtitle, locale)}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#services" className="btn-primary">
                {th("chooseService")}
                <ArrowDown className="h-4 w-4" />
              </a>
              <WhatsAppLink href={wa} place="hero" className="btn-ghost">
                <WhatsAppIcon className="h-5 w-5 text-accent" />
                {tn("whatsapp")}
              </WhatsAppLink>
            </div>

            {settings.stats?.length ? (
              <dl className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-line pt-6">
                {settings.stats.map((s) => (
                  <div key={s._key}>
                    <dt className="sr-only">{l(s.label, locale)}</dt>
                    <dd className="text-[26px] leading-none font-bold tracking-[-0.04em] sm:text-[32px]">{s.value}</dd>
                    <dd className="mt-2 text-[13px] leading-snug text-muted sm:text-[14px]">{l(s.label, locale)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <Media
            image={settings.heroImage}
            locale={locale}
            placeholder={th("photoPlaceholder")}
            sizes="(min-width: 1024px) 520px, 100vw"
            className="aspect-[4/3] rounded-[20px] lg:aspect-[4/5]"
            priority
          />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading title={t("servicesTitle")} subtitle={t("servicesSubtitle")} />
          {groups.length === 0 ? (
            <p className="text-muted">{t("noServices")}</p>
          ) : (
            <div className="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.flatMap((g) => g.services).map((s) => (
                <ServiceCard key={s._id} service={s} locale={locale} showCategory />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How we work */}
      <section className="bg-ink py-16 text-white sm:py-24">
        <div className="container-x">
          <h2 className="h-section max-w-xl">{t("howTitle")}</h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {how.map((step, i) => (
              <li key={i} className="reveal border-t border-white/15 pt-5">
                <span className="text-[14px] font-semibold text-accent tabular-nums">0{i + 1}</span>
                <p className="mt-3 text-[19px] font-semibold tracking-[-0.015em]">{step.title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/65">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-x">
            <SectionHeading title={t("reviewsTitle")} />
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r._id} className="card flex w-[85%] shrink-0 snap-start flex-col p-6 sm:w-auto">
                  <div className="flex gap-0.5 text-accent" aria-label={`${r.rating ?? 5}/5`}>
                    {Array.from({ length: r.rating ?? 5 }, (_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-[16px] leading-relaxed text-ink/85">{l(r.text, locale)}</blockquote>
                  <figcaption className="mt-5 border-t border-line pt-4">
                    <p className="font-semibold">{r.name}</p>
                    {r.service?.title && <p className="text-[14px] text-muted">{l(r.service.title, locale)}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className={`py-16 sm:py-24 ${reviews.length ? "border-t border-line" : ""}`}>
          <div className="container-x grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <h2 className="h-section">{t("faqTitle")}</h2>
            <FaqList items={faq.map((f) => ({ key: f._id, question: l(f.question, locale), answer: l(f.answer, locale) }))} />
          </div>
        </section>
      )}

      <LeadSection locale={locale} />
    </>
  );
}

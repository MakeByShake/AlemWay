import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { ArrowDown, Check, Star } from "lucide-react";
import { getFaq, getReviews, getService, getServicesByCategory, getSettings } from "@/lib/data";
import { l, siteUrl, whatsappLink } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { Media, PhotoCredit } from "@/components/Media";
import { HeroServices, type HeroServiceItem } from "@/components/HeroServices";
import type { FeaturesBlock } from "@/lib/types";
import { hasImage, imageUrl } from "@/sanity/image";
import { ServiceCard } from "@/components/ServiceCard";
import { FaqList, LeadSection, SectionHeading, Ticker } from "@/components/Sections";
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
  // Hero carousel: every service with what's included, popular ones first.
  const allServices = groups.flatMap((g) => g.services).sort((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)));
  const fullServices = await Promise.all(allServices.map((s) => getService(s.slug.current)));
  const heroItems: HeroServiceItem[] = allServices.map((s, i) => {
    const full = fullServices[i];
    const features = (full?.blocks ?? []).find((b): b is FeaturesBlock => b._type === "features")?.items?.slice(0, 4) ?? [];
    return {
      slug: s.slug.current,
      title: l(s.title, locale),
      label: s.popular ? th("popular") : l(s.category?.title, locale),
      countryCode: s.countryCode,
      flagImage: s.flagImage,
      features: features.map((f) => l(f, locale)).filter(Boolean),
      duration: l(s.duration, locale),
    };
  });
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

      {/* Hero: full-bleed photo with dark overlay, exactly one screen tall; the header floats over it. */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white">
        {hasImage(settings.heroImage) && (
          <Image
            src={imageUrl(settings.heroImage, 1920)}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
        )}
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,15,36,0.88),rgba(11,15,36,0.55)_45%,rgba(11,15,36,0.1)),linear-gradient(180deg,rgba(11,15,36,0)_40%,rgba(11,15,36,0.7)),radial-gradient(700px_380px_at_85%_-10%,rgba(35,64,255,0.35),transparent_60%)]"
          aria-hidden
        />
        <div className="container-x grid flex-1 content-center gap-8 [&>*]:min-w-0 pt-24 pb-10 sm:pt-28 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14 lg:pt-[104px] lg:pb-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {th("badge")}
            </p>
            <h1 className="h-display mt-5 max-w-[16ch] text-balance [@media(min-width:1024px)_and_(max-height:760px)]:text-[54px]">
              {l(settings.heroTitle, locale)}{" "}
              {l(settings.heroTitleAccent, locale) && <span className="text-[#3ee08f]">{l(settings.heroTitleAccent, locale)}</span>}
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-lg">{l(settings.heroSubtitle, locale)}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#services" className="btn-primary shadow-[0_10px_30px_-10px_rgba(35,64,255,0.8)]">
                {th("chooseService")}
                <ArrowDown className="h-4 w-4" />
              </a>
              <WhatsAppLink href={wa} place="hero" className="btn-whatsapp">
                <WhatsAppIcon className="h-5 w-5" />
                {tn("whatsapp")}
              </WhatsAppLink>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-white/75">
              {(th.raw("trust") as string[]).map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#3ee08f]" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
            {/* Hidden on short laptop screens so the hero still fits in one screen. */}
            <div className="mt-7 flex items-center gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:hidden">
              <div className="flex -space-x-2" aria-hidden>
                {["А", "Д", "М", "Е", "Н"].map((ch, i) => (
                  <span
                    key={ch}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-[12px] font-bold text-white"
                    style={{ background: ["#2340FF", "#10B864", "#F59E0B", "#7C3AED", "#0EA5E9"][i] }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <p className="text-[14px] text-white/75">{th.rich("trustPeople", { b: (chunks) => <b className="font-semibold text-white">{chunks}</b> })}</p>
            </div>
          </div>

          <HeroServices
            items={heroItems}
            labels={{ prev: th("carouselPrev"), next: th("carouselNext"), cta: th("cardCta"), region: th("carouselRegion"), slide: th("carouselSlide") }}
          />
        </div>
        {settings.heroImage?.credit && <PhotoCredit credit={settings.heroImage.credit} />}
      </section>

      <Ticker items={t.raw("ticker") as string[]} />

      {/* Stats band */}
      {settings.stats?.length ? (
        <section className="border-b border-line bg-white">
          <dl className="container-x grid grid-cols-2 lg:grid-cols-4">
            {[
              ...settings.stats.map((s) => ({ key: s._key, value: s.value, label: l(s.label, locale) })),
              { key: "resp", value: t("responseValue"), label: t("responseLabel") },
            ].map((s, i) => (
              <div key={s.key} className={`px-2 py-7 text-center sm:py-9 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-[30px] leading-none font-extrabold tracking-[-0.04em] text-brand sm:text-[38px]">{s.value}</dd>
                <dd className="mt-2 text-[13px] text-muted sm:text-[14px]">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Services */}
      <section id="services" className="scroll-mt-20 bg-surface py-16 sm:py-24">
        <div className="container-x">
          <SectionHeading eyebrow={t("servicesEyebrow")} title={t("servicesTitle")} accent={t("servicesAccent")} subtitle={t("servicesSubtitle")} center />
          {groups.length === 0 ? (
            <p className="text-center text-muted">{t("noServices")}</p>
          ) : (
            <div className="reveal grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.flatMap((g) => g.services).map((s) => (
                <ServiceCard key={s._id} service={s} locale={locale} showCategory />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why us: photo + checklist */}
      <section className="py-16 sm:py-24">
        <div className="container-x grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative">
            <Media
              image={settings.officeImage}
              locale={locale}
              placeholder={th("photoPlaceholder")}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="aspect-[4/3] rounded-[24px]"
              width={1200}
            />
            <div className="absolute -bottom-5 left-5 rounded-2xl bg-white p-4 shadow-[0_16px_40px_-16px_rgba(11,15,36,0.35)] sm:left-8">
              <p className="text-[28px] leading-none font-extrabold tracking-[-0.04em] text-brand">1000+</p>
              <p className="mt-1 text-[13px] text-muted">{settings.stats?.[1] ? l(settings.stats[1].label, locale) : ""}</p>
            </div>
          </div>
          <div className="pt-6 lg:pt-0">
            <SectionHeading eyebrow={t("whyEyebrow")} title={t("whyTitle")} accent={t("whyAccent")} subtitle={t("whyText")} />
            <ul className="-mt-4 space-y-3">
              {(t.raw("why") as string[]).map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-snug">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How we work */}
      <section className="bg-ink py-16 text-white sm:py-24">
        <div className="container-x">
          <SectionHeading eyebrow={t("howEyebrow")} title={t("howTitle")} dark />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {how.map((step, i) => (
              <li key={i} className="reveal rounded-[18px] border border-white/10 bg-white/[0.04] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[15px] font-bold">{i + 1}</span>
                <p className="mt-5 text-[19px] font-semibold tracking-[-0.015em]">{step.title}</p>
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
            <SectionHeading eyebrow={t("faqEyebrow")} title={t("faqTitle")} />
            <FaqList items={faq.map((f) => ({ key: f._id, question: l(f.question, locale), answer: l(f.answer, locale) }))} />
          </div>
        </section>
      )}

      <LeadSection locale={locale} />
    </>
  );
}

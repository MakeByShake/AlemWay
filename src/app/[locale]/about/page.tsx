import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSettings } from "@/lib/data";
import { l } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { Media } from "@/components/Media";
import { LeadSection, Prose } from "@/components/Sections";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/about", title: t("aboutTitle"), description: t("aboutDescription") });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [settings, t] = await Promise.all([getSettings(), getTranslations("about")]);
  const values = t.raw("values") as { title: string; text: string }[];

  return (
    <>
      <section className="container-x grid gap-10 py-12 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
        <div>
          <h1 className="h-display">{t("title")}</h1>
          <p className="mt-6 text-[19px] leading-relaxed font-medium text-ink sm:text-[21px]">{t("lead")}</p>
          <Prose text={settings.aboutText} locale={locale} className="mt-6" />
        </div>
        <Media
          image={settings.aboutImage}
          locale={locale}
          placeholder={t("photo")}
          sizes="(min-width: 1024px) 480px, 100vw"
          className="aspect-[4/3] rounded-[20px]"
        />
      </section>

      {settings.stats?.length ? (
        <section className="border-y border-line">
          <dl className="container-x grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {settings.stats.map((s) => (
              <div key={s._key} className="py-8 sm:px-8 sm:first:pl-0">
                <dt className="sr-only">{l(s.label, locale)}</dt>
                <dd className="text-[44px] leading-none font-bold tracking-[-0.045em] text-brand">{s.value}</dd>
                <dd className="mt-2 text-[15px] text-muted">{l(s.label, locale)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="container-x py-16 sm:py-24">
        <h2 className="h-section">{t("valuesTitle")}</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {values.map((v, i) => (
            <div key={i} className="border-t-2 border-ink pt-5">
              <p className="text-[19px] font-semibold tracking-[-0.015em]">{v.title}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-muted">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <LeadSection locale={locale} />
    </>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getServicesByCategory } from "@/lib/data";
import { l } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { ServiceCard } from "@/components/ServiceCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { LeadSection } from "@/components/Sections";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/services", title: t("servicesTitle"), description: t("servicesDescription") });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [groups, tm, ts, th] = await Promise.all([
    getServicesByCategory(),
    getTranslations("meta"),
    getTranslations("service"),
    getTranslations("home"),
  ]);

  return (
    <>
      <section className="py-12 sm:py-20">
        <div className="container-x">
          <h1 className="h-display">{tm("servicesTitle")}</h1>
          <p className="mt-4 mb-10 max-w-2xl text-[17px] leading-relaxed text-muted">{th("servicesSubtitle")}</p>
          {groups.length === 0 ? (
            <p className="text-muted">{th("noServices")}</p>
          ) : (
            <CategoryFilter
              allLabel={ts("all")}
              groups={groups.map((g) => ({
                id: g.category?._id ?? "other",
                title: g.category ? l(g.category.title, locale) : ts("all"),
                content: (
                  <>
                    {g.category && (
                      <h2 className="mb-4 flex items-center gap-3 text-[13px] font-semibold tracking-[0.08em] text-muted uppercase">
                        {l(g.category.title, locale)}
                        <span className="h-px flex-1 bg-line" aria-hidden />
                      </h2>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {g.services.map((s) => (
                        <ServiceCard key={s._id} service={s} locale={locale} />
                      ))}
                    </div>
                  </>
                ),
              }))}
            />
          )}
        </div>
      </section>
      <LeadSection locale={locale} />
    </>
  );
}

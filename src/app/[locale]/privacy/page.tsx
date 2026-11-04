import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { privacy } from "@/content/privacy";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/privacy", title: t("privacyTitle"), description: t("privacyDescription") });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meta");
  const doc = privacy[locale] ?? privacy.ru;

  return (
    <article className="container-x py-12 sm:py-20">
      <div className="max-w-3xl">
        <h1 className="h-section sm:text-5xl">{t("privacyTitle")}</h1>
        <p className="mt-3 text-[14px] text-muted">{doc.updated}</p>
        <p className="mt-8 text-[17px] leading-relaxed text-ink/80">{doc.intro}</p>
        <div className="mt-10 space-y-10">
          {doc.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-[21px] font-bold tracking-[-0.02em]">{s.title}</h2>
              <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink/80">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

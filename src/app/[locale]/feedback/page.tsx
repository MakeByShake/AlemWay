import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { getSettings } from "@/lib/data";
import { whatsappLink } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SectionHeading } from "@/components/Sections";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/feedback", title: t("feedbackTitle"), description: t("feedbackDescription") });
}

export default async function FeedbackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [settings, t] = await Promise.all([getSettings(), getTranslations("feedback")]);
  const points = t.raw("points") as string[];

  return (
    <section className="bg-surface py-12 sm:py-20">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="lg:pt-4">
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} accent={t("accent")} subtitle={t("lead")} />
          <ul className="-mt-4 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-[16px] leading-snug">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <FeedbackForm whatsappHref={whatsappLink(settings.whatsapp)} />
      </div>
    </section>
  );
}

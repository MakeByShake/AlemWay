import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/Sections";
import { ConsultationForm } from "@/components/ConsultationForm";
import { CONSULTATION_PRICE, bookableDays } from "@/lib/consultation";
import { getConsultants } from "@/lib/consultants";

// Free days change every day — render on request.
export const dynamic = "force-dynamic";

const TEXT = {
  ru: {
    title: "Консультация",
    eyebrow: "Запись онлайн",
    heading: "Консультация",
    accent: "с экспертом AlemWay",
    lead: "Разберём вашу ситуацию: какая программа подходит, какие документы нужны, сроки и шансы.",
    meta: "Запишитесь на консультацию AlemWay Visa: Work&Travel Германия, K-ETA, визы. 2 000 ₸, будни 10:00–19:00.",
    points: ["Стоимость — 2 000 ₸", "Будни, с 10:00 до 19:00 (время Алматы)", "Около часа: в офисе или по звонку в WhatsApp", "Менеджер подтвердит запись и пришлёт оплату"],
  },
  kk: {
    title: "Кеңес",
    eyebrow: "Онлайн жазылу",
    heading: "Кеңес",
    accent: "AlemWay сарапшысымен",
    lead: "Жағдайыңызды талдаймыз: қай бағдарлама сәйкес келеді, қандай құжаттар керек, мерзімдер мен мүмкіндіктер.",
    meta: "AlemWay Visa кеңесіне жазылыңыз: Германиядағы Work&Travel, K-ETA, визалар. 2 000 ₸, жұмыс күндері 10:00–19:00.",
    points: ["Құны — 2 000 ₸", "Жұмыс күндері, 10:00–19:00 (Алматы уақыты)", "Шамамен бір сағат: кеңседе немесе WhatsApp қоңырауы арқылы", "Менеджер жазылуды растап, төлем жібереді"],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = TEXT[locale === "kk" ? "kk" : "ru"];
  return pageMetadata({ locale, path: "/consultation", title: t.title, description: t.meta });
}

export default async function ConsultationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale === "kk" ? "kk" : "ru";
  const t = TEXT[loc];
  void CONSULTATION_PRICE;
  return (
    <section className="bg-surface py-12 sm:py-20">
      <div className="container-x grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16 [&>*]:min-w-0">
        <div className="lg:pt-4">
          <SectionHeading eyebrow={t.eyebrow} title={t.heading} accent={t.accent} subtitle={t.lead} />
          <ul className="-mt-4 space-y-3">
            {t.points.map((p) => (
              <li key={p} className="flex gap-3 text-[16px] leading-snug">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <ConsultationForm days={bookableDays()} locale={loc} consultants={(await getConsultants().catch(() => [])).map((c) => ({ key: c.key, name: c.name }))} />
      </div>
    </section>
  );
}

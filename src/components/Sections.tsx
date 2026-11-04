import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getServices, getSettings } from "@/lib/data";
import { l, paragraphs, whatsappLink } from "@/lib/i18n-content";
import type { LocaleText } from "@/lib/types";
import { LeadForm } from "./LeadForm";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

export function Prose({ text, locale, className = "" }: { text?: LocaleText; locale: string; className?: string }) {
  const value = l(text, locale);
  if (!value) return null;
  return (
    <div className={`space-y-4 text-[16px] leading-[1.7] text-ink/80 sm:text-[17px] ${className}`}>
      {paragraphs(value).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export type QA = { key: string; question: string; answer: string };

/** Accordion on <details>: works without JavaScript. */
export function FaqList({ items }: { items: QA[] }) {
  if (!items.length) return null;
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <details key={it.key} className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold tracking-[-0.01em] sm:text-lg">
            {it.question}
            <Plus className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45" />
          </summary>
          <div className="pb-5 text-[16px] leading-relaxed whitespace-pre-line text-muted">{it.answer}</div>
        </details>
      ))}
    </div>
  );
}

/** Lead form block with heading and a WhatsApp alternative. */
export async function LeadSection({
  locale,
  defaultService,
  whatsappText,
  title,
  subtitle,
  id = "lead",
}: {
  locale: string;
  defaultService?: string;
  whatsappText?: string;
  title?: string;
  subtitle?: string;
  id?: string;
}) {
  const [services, settings, t] = await Promise.all([getServices(), getSettings(), getTranslations("home")]);
  const options = services.map((s) => ({ slug: s.slug.current, title: l(s.title, locale) }));
  const wa = whatsappLink(settings.whatsapp, whatsappText);

  return (
    <section id={id} className="scroll-mt-24 bg-surface py-16 sm:py-24">
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="lg:pt-4">
          <h2 className="h-section">{title ?? t("leadTitle")}</h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">{subtitle ?? t("leadSubtitle")}</p>
          <div className="mt-8">
            <p className="text-[14px] font-semibold text-ink/70">{t("orWhatsapp")}</p>
            <WhatsAppLink href={wa} place="lead_section" className="btn-whatsapp mt-3">
              <WhatsAppIcon /> WhatsApp · {settings.phone}
            </WhatsAppLink>
          </div>
        </div>
        <LeadForm services={options} defaultService={defaultService} whatsappHref={wa} />
      </div>
    </section>
  );
}

export function SectionHeading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <div className="mb-10 max-w-2xl sm:mb-12">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="h-section">{title}</h2>
      {subtitle && <p className="mt-3 text-[17px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}

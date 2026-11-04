import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { getSettings } from "@/lib/data";
import { l, whatsappLink } from "@/lib/i18n-content";
import { pageMetadata } from "@/lib/seo";
import { Media } from "@/components/Media";
import { LeadSection } from "@/components/Sections";
import { InstagramIcon, WhatsAppIcon, WhatsAppLink } from "@/components/WhatsAppLink";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/contacts", title: t("contactsTitle"), description: t("contactsDescription") });
}

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [s, t, th] = await Promise.all([getSettings(), getTranslations("contacts"), getTranslations("hero")]);
  const phoneDigits = (s.whatsapp || s.phone || "").replace(/\D/g, "");

  const rows = [
    s.phone && { icon: Phone, label: t("phone"), value: s.phone, href: `tel:+${phoneDigits}` },
    s.email && { icon: Mail, label: t("email"), value: s.email, href: `mailto:${s.email}` },
    s.instagram && { icon: InstagramIcon, label: t("instagram"), value: `@${s.instagram}`, href: `https://instagram.com/${s.instagram}` },
    l(s.address, locale) && { icon: MapPin, label: t("address"), value: l(s.address, locale) },
    l(s.workingHours, locale) && { icon: Clock, label: t("hours"), value: l(s.workingHours, locale) },
  ].filter(Boolean) as { icon: LucideIcon | typeof InstagramIcon; label: string; value: string; href?: string }[];

  return (
    <>
      <section className="container-x grid gap-10 py-12 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <h1 className="h-display">{t("title")}</h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">{t("lead")}</p>
          <WhatsAppLink href={whatsappLink(s.whatsapp)} place="contacts" className="btn-whatsapp mt-8">
            <WhatsAppIcon /> WhatsApp
          </WhatsAppLink>
          <dl className="mt-10 divide-y divide-line border-y border-line">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-4 py-4">
                <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                <div>
                  <dt className="text-[13px] text-muted">{r.label}</dt>
                  <dd className="mt-0.5 text-[17px] font-semibold">
                    {r.href ? (
                      <a href={r.href} className="hover:text-brand" {...(r.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
        <Media
          image={s.officeImage}
          locale={locale}
          placeholder={th("photoPlaceholder")}
          sizes="(min-width: 1024px) 560px, 100vw"
          className="aspect-[4/3] rounded-[20px] lg:sticky lg:top-24"
        />
      </section>
      <LeadSection locale={locale} />
    </>
  );
}

import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getServices, getSettings } from "@/lib/data";
import { l, whatsappLink } from "@/lib/i18n-content";
import { Logo } from "./Logo";
import { InstagramIcon, WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

export async function Footer({ locale }: { locale: string }) {
  const [services, s, t, nav] = await Promise.all([
    getServices(),
    getSettings(),
    getTranslations("footer"),
    getTranslations("nav"),
  ]);
  const year = new Date().getFullYear();
  const linkCls = "text-white/70 transition-colors hover:text-white";

  return (
    <footer className="bg-ink pb-24 text-white lg:pb-0">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo variant="white" className="h-7 w-auto" />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">{t("tagline")}</p>
          <p className="mt-3 text-[13px] text-white/50 italic">Where Your Journey Begins</p>
        </div>

        <div>
          <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-white/50 uppercase">{t("services")}</p>
          <ul className="space-y-2 text-[15px]">
            {services.map((svc) => (
              <li key={svc._id}>
                <Link href={`/services/${svc.slug.current}`} className={linkCls}>
                  {l(svc.title, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-white/50 uppercase">{t("company")}</p>
          <ul className="space-y-2 text-[15px]">
            <li>
              <Link href="/about" className={linkCls}>
                {nav("about")}
              </Link>
            </li>
            <li>
              <Link href="/contacts" className={linkCls}>
                {nav("contacts")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkCls}>
                {t("privacy")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-white/50 uppercase">{t("contacts")}</p>
          <ul className="space-y-3 text-[15px]">
            {s.phone && (
              <li>
                <a href={`tel:+${(s.whatsapp || s.phone).replace(/\D/g, "")}`} className={`inline-flex items-center gap-2 ${linkCls}`}>
                  <Phone className="h-4 w-4" /> {s.phone}
                </a>
              </li>
            )}
            <li>
              <WhatsAppLink href={whatsappLink(s.whatsapp)} place="footer" className={`inline-flex items-center gap-2 ${linkCls}`}>
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </WhatsAppLink>
            </li>
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className={`inline-flex items-center gap-2 ${linkCls}`}>
                  <Mail className="h-4 w-4" /> {s.email}
                </a>
              </li>
            )}
            {s.instagram && (
              <li>
                <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 ${linkCls}`}>
                  <InstagramIcon className="h-4 w-4" /> @{s.instagram}
                </a>
              </li>
            )}
            {l(s.address, locale) && (
              <li className="inline-flex items-center gap-2 text-white/70">
                <MapPin className="h-4 w-4" /> {l(s.address, locale)}
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-[13px] text-white/50 sm:flex-row sm:justify-between">
          <p>
            © {year} AlemWay Visa. {t("rights")}
          </p>
          <Link href="/privacy" className="hover:text-white">
            {t("privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}

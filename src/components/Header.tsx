import { getTranslations } from "next-intl/server";
import { getServices, getServicesByCategory, getSettings } from "@/lib/data";
import { serviceWhatsappMap } from "@/lib/service-whatsapp";
import { l, whatsappLink } from "@/lib/i18n-content";
import { HeaderNav, type NavGroup } from "./HeaderNav";

export async function Header({ locale }: { locale: string }) {
  const [groups, services, settings, t] = await Promise.all([getServicesByCategory(), getServices(), getSettings(), getTranslations("nav")]);

  const nav: NavGroup[] = groups.map((g) => ({
    title: g.category ? l(g.category.title, locale) : t("services"),
    items: g.services.map((s) => ({
      title: l(s.title, locale),
      slug: s.slug.current,
      countryCode: s.countryCode,
      flagImage: s.flagImage,
    })),
  }));

  return <HeaderNav groups={nav} whatsappHref={whatsappLink(settings.whatsapp)} serviceWhatsapp={serviceWhatsappMap(services, locale)} />;
}

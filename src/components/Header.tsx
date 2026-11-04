import { getTranslations } from "next-intl/server";
import { getServicesByCategory, getSettings } from "@/lib/data";
import { l, whatsappLink } from "@/lib/i18n-content";
import { HeaderNav, type NavGroup } from "./HeaderNav";

export async function Header({ locale }: { locale: string }) {
  const [groups, settings, t] = await Promise.all([getServicesByCategory(), getSettings(), getTranslations("nav")]);

  const nav: NavGroup[] = groups.map((g) => ({
    title: g.category ? l(g.category.title, locale) : t("services"),
    items: g.services.map((s) => ({
      title: l(s.title, locale),
      slug: s.slug.current,
      countryCode: s.countryCode,
      flagImage: s.flagImage,
    })),
  }));

  return <HeaderNav groups={nav} whatsappHref={whatsappLink(settings.whatsapp)} />;
}

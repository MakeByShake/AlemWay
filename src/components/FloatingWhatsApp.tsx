import { getLocale, getTranslations } from "next-intl/server";
import { getServices, getSettings } from "@/lib/data";
import { serviceWhatsappMap } from "@/lib/service-whatsapp";
import { whatsappLink } from "@/lib/i18n-content";
import { FloatingWhatsAppButton } from "./FloatingWhatsAppButton";

/** Floating WhatsApp button for phones (bottom-right). On a service page it uses that service's number. */
export async function FloatingWhatsApp() {
  const [s, services, t, locale] = await Promise.all([getSettings(), getServices(), getTranslations("nav"), getLocale()]);
  return (
    <FloatingWhatsAppButton
      defaultHref={whatsappLink(s.whatsapp)}
      byService={serviceWhatsappMap(services, locale)}
      label={t("whatsapp")}
    />
  );
}

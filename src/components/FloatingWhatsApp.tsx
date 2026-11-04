import { getTranslations } from "next-intl/server";
import { getSettings } from "@/lib/data";
import { whatsappLink } from "@/lib/i18n-content";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

/** Floating WhatsApp button for phones (bottom-right). */
export async function FloatingWhatsApp() {
  const [s, t] = await Promise.all([getSettings(), getTranslations("nav")]);
  return (
    <WhatsAppLink
      href={whatsappLink(s.whatsapp)}
      place="floating"
      ariaLabel={t("whatsapp")}
      className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgba(16,184,100,0.6)] transition-transform hover:scale-105 lg:hidden"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </WhatsAppLink>
  );
}

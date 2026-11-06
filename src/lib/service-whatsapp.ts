import { l, whatsappLink } from "./i18n-content";
import type { Service } from "./types";

/** slug → WhatsApp link (with the service's greeting text) for services that have their own number. */
export function serviceWhatsappMap(services: Service[], locale: string): Record<string, string> {
  return Object.fromEntries(
    services
      .filter((s) => s.whatsappNumber)
      .map((s) => [s.slug.current, whatsappLink(s.whatsappNumber, l(s.whatsappText, locale) || undefined)])
  );
}

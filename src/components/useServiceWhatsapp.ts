"use client";

import { usePathname } from "@/i18n/navigation";

/** slug → WhatsApp link for services that have their own number. */
export type ServiceWhatsapp = Record<string, string>;

/** On a service page with its own WhatsApp number, use that number; elsewhere the site-wide one. */
export function useServiceWhatsapp(defaultHref: string, byService: ServiceWhatsapp = {}) {
  const pathname = usePathname();
  const slug = pathname.match(/^\/services\/([^/]+)/)?.[1];
  return (slug && byService[slug]) || defaultHref;
}

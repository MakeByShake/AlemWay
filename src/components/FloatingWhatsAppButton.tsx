"use client";

import { usePathname } from "@/i18n/navigation";
import { useServiceWhatsapp, type ServiceWhatsapp } from "./useServiceWhatsapp";
import { WhatsAppIcon, WhatsAppLink } from "./WhatsAppLink";

export function FloatingWhatsAppButton({ defaultHref, byService, label }: { defaultHref: string; byService: ServiceWhatsapp; label: string }) {
  const href = useServiceWhatsapp(defaultHref, byService);
  // In the personal cabinet this corner belongs to the chat with AlemWay (WhatsApp stays in the «Есть вопрос?» card).
  if (usePathname().startsWith("/cabinet")) return null;
  return (
    <WhatsAppLink
      href={href}
      place="floating"
      ariaLabel={label}
      className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgba(16,184,100,0.6)] transition-transform hover:scale-105 lg:hidden"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </WhatsAppLink>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { currentCabinet } from "@/lib/cabinet/server";
import { cabinetLocale } from "@/lib/cabinet/i18n";
import { CabinetChat } from "@/components/cabinet/CabinetChat";
import { CabinetLock } from "@/components/cabinet/CabinetLock";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: cabinetLocale(locale) === "kk" ? "AlemWay чаты" : "Чат с AlemWay", robots: { index: false, follow: false } };
}

/** The client's chat with AlemWay, on the whole screen (opened from the cabinet and from notifications). */
export default async function CabinetChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cab = await currentCabinet().catch(() => null);
  // Not logged in (old link, another device): the cabinet page explains what to do.
  if (!cab) redirect(`/${locale}/cabinet`);
  const lang = cabinetLocale(locale);
  return (
    <>
      <CabinetChat locale={lang} />
      <CabinetLock locale={lang} />
    </>
  );
}

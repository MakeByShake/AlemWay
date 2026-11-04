import "@fontsource-variable/inter/wght.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { SiteScripts } from "@/components/SiteScripts";
import { siteUrl } from "@/lib/i18n-content";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("homeTitle"), template: "%s — AlemWay Visa" },
    description: t("homeDescription"),
    applicationName: "AlemWay Visa",
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#2340FF",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <Header locale={locale} />
          <main id="main">{children}</main>
          <Footer locale={locale} />
          <FloatingWhatsApp />
          <SiteScripts />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}

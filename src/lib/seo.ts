import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "./i18n-content";

export const HREFLANG: Record<string, string> = { ru: "ru-KZ", kk: "kk-KZ", de: "de-DE" };

/** Metadata with canonical + hreflang ru/kk/de for a path like "/services/k-eta" ("" = home). */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  absoluteTitle = false,
}: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  image?: string;
  absoluteTitle?: boolean;
}): Metadata {
  const url = (loc: string) => `${siteUrl()}/${loc}${path}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[HREFLANG[loc] ?? loc] = url(loc);
  languages["x-default"] = url(routing.defaultLocale);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url(locale), languages },
    openGraph: {
      type: "website",
      url: url(locale),
      title,
      description,
      siteName: "AlemWay Visa",
      locale: (HREFLANG[locale] ?? "ru-KZ").replace("-", "_"),
      images: [{ url: image || `${siteUrl()}/og-default.png`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

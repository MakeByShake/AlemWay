import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "./i18n-content";

/** Metadata with canonical + hreflang ru/kk for a path like "/services/k-eta" ("" = home). */
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
  for (const loc of routing.locales) languages[loc === "kk" ? "kk-KZ" : "ru-KZ"] = url(loc);
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
      locale: locale === "kk" ? "kk_KZ" : "ru_KZ",
      images: [{ url: image || `${siteUrl()}/og-default.png`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

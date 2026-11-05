import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/i18n-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/studio", "/api/", "/c/", "/ru/cabinet", "/kk/cabinet"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

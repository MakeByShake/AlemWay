import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getServices } from "@/lib/data";
import { siteUrl } from "@/lib/i18n-content";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const services = await getServices();
  const paths = [
    { path: "", priority: 1 },
    { path: "/services", priority: 0.9 },
    ...services.map((s) => ({ path: `/services/${s.slug.current}`, priority: 0.8 })),
    { path: "/about", priority: 0.5 },
    { path: "/contacts", priority: 0.6 },
    { path: "/feedback", priority: 0.3 },
    { path: "/consultation", priority: 0.6 },
    { path: "/privacy", priority: 0.2 },
  ];

  return paths.flatMap(({ path, priority }) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      priority,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l === "kk" ? "kk-KZ" : "ru-KZ", `${base}/${l}${path}`])),
      },
    }))
  );
}

import "server-only";
import { cache } from "react";
import { client } from "@/sanity/client";
import {
  categoriesQuery,
  faqQuery,
  reviewsQuery,
  serviceBySlugQuery,
  servicesQuery,
  settingsQuery,
} from "@/sanity/queries";
import { seedCategories, seedFaq, seedReviews, seedServices, seedSettings } from "@/content/seed";
import type { Category, FaqItem, Review, Service, SiteSettings } from "./types";

/** All Sanity content shares one cache tag; the webhook at /api/revalidate refreshes it. */
export const SANITY_TAG = "sanity";
const REVALIDATE_SECONDS = 3600;

async function fetchSanity<T>(query: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!client) return null;
  try {
    return await client.fetch<T>(query, params, {
      next: { revalidate: REVALIDATE_SECONDS, tags: [SANITY_TAG] },
    });
  } catch (err) {
    console.error("[sanity] fetch failed", err);
    return null;
  }
}

const usingSanity = () => client !== null;

export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (!usingSanity()) return seedSettings;
  const data = await fetchSanity<SiteSettings>(settingsQuery);
  // Fill missing fields from defaults so the site never shows empty contacts.
  return { ...seedSettings, ...(data ?? {}) } as SiteSettings;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!usingSanity()) return seedCategories;
  return (await fetchSanity<Category[]>(categoriesQuery)) ?? [];
});

export const getServices = cache(async (): Promise<Service[]> => {
  if (!usingSanity()) return seedServices.filter((s) => s.visible !== false);
  return (await fetchSanity<Service[]>(servicesQuery)) ?? [];
});

export const getService = cache(async (slug: string): Promise<Service | null> => {
  if (!usingSanity()) return seedServices.find((s) => s.slug.current === slug && s.visible !== false) ?? null;
  return fetchSanity<Service>(serviceBySlugQuery, { slug });
});

export const getReviews = cache(async (): Promise<Review[]> => {
  if (!usingSanity()) return seedReviews;
  return (await fetchSanity<Review[]>(reviewsQuery)) ?? [];
});

export const getFaq = cache(async (): Promise<FaqItem[]> => {
  if (!usingSanity()) return seedFaq;
  return (await fetchSanity<FaqItem[]>(faqQuery)) ?? [];
});

/** Services grouped by category, in category order. Services without a category go last. */
export async function getServicesByCategory() {
  const [categories, services] = await Promise.all([getCategories(), getServices()]);
  const groups = categories
    .map((category) => ({
      category,
      services: services.filter((s) => s.category?._id === category._id),
    }))
    .filter((g) => g.services.length > 0);
  const orphans = services.filter((s) => !s.category || !categories.some((c) => c._id === s.category?._id));
  if (orphans.length) groups.push({ category: null as unknown as Category, services: orphans });
  return groups;
}

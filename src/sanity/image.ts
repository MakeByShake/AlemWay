import { createImageUrlBuilder } from "@sanity/image-url";
import { dataset, isSanityConfigured, projectId } from "./env";
import type { SanityImage } from "@/lib/types";

const builder = isSanityConfigured ? createImageUrlBuilder({ projectId, dataset }) : null;

export function hasImage(img?: SanityImage | null): img is SanityImage {
  return Boolean(img?.asset?._ref);
}

export function urlFor(img: SanityImage) {
  if (!builder) throw new Error("Sanity is not configured");
  return builder.image(img).auto("format");
}

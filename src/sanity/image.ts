import { createImageUrlBuilder } from "@sanity/image-url";
import { dataset, isSanityConfigured, projectId } from "./env";
import type { SanityImage } from "@/lib/types";

const builder = isSanityConfigured ? createImageUrlBuilder({ projectId, dataset }) : null;

/** True if the image points to a Sanity asset or a local file. */
export function hasImage(img?: SanityImage | null): img is SanityImage {
  return Boolean(img?.asset?._ref || img?.src);
}

export function urlFor(img: SanityImage) {
  if (!builder) throw new Error("Sanity is not configured");
  return builder.image(img).auto("format");
}

/** URL of an image at a given width (Sanity CDN or local /public file). */
export function imageUrl(img: SanityImage, width: number, height?: number) {
  if (img.src) return img.src;
  const b = urlFor(img).width(width);
  return (height ? b.height(height) : b).url();
}

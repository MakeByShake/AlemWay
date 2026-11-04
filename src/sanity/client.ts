import { createClient, type SanityClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "./env";

export const client: SanityClient | null = isSanityConfigured
  ? createClient({ projectId, dataset, apiVersion, useCdn: true, perspective: "published" })
  : null;

/** Server-only client with write access (used to save leads). Never import in client components. */
export function getWriteClient(): SanityClient | null {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!isSanityConfigured || !token) return null;
  return createClient({ projectId, dataset, apiVersion, useCdn: false, token });
}

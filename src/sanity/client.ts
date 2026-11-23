import { createClient, type SanityClient } from "next-sanity";
import { apiVersion, dataset, isSanityConfigured, projectId } from "./env";

/** Local tests only: SANITY_API_HOST points both clients at a stand-in API. Never set it on the real site. */
const testHost = process.env.SANITY_API_HOST;
const host = testHost ? { apiHost: testHost, useProjectHostname: false } : {};

export const client: SanityClient | null = isSanityConfigured
  ? createClient({ projectId, dataset, apiVersion, useCdn: !testHost, perspective: "published", ...host })
  : null;

/** Server-only client with write access (used to save leads). Never import in client components. */
export function getWriteClient(): SanityClient | null {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!isSanityConfigured || !token) return null;
  return createClient({ projectId, dataset, apiVersion, useCdn: false, token, ...host });
}

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-01";

/** True when the Sanity project is set up. Until then the site uses src/content/seed.ts. */
export const isSanityConfigured = /^[a-z0-9-]+$/.test(projectId);

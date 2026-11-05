import type { SchemaTypeDefinition } from "sanity";
import { localeString, localeText, seo } from "./locale";
import { pageBlocks } from "./blocks";
import { category, faqItem, lead, review, service, siteSettings } from "./documents";
import { cabinet } from "./cabinet";

export const schemaTypes: SchemaTypeDefinition[] = [
  localeString,
  localeText,
  seo,
  ...pageBlocks,
  siteSettings,
  category,
  service,
  review,
  faqItem,
  lead,
  cabinet,
];

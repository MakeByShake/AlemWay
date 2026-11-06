import { defineQuery } from "next-sanity";

const serviceCard = `
  _id, _type, title, slug, countryCode, flagImage, coverImage, excerpt, badge,
  price, priceOnRequest, duration, whatsappText, whatsappNumber, order, visible, popular,
  "category": category->{_id, _type, title, slug, order}
`;

export const settingsQuery = defineQuery(`*[_type == "siteSettings"][0]`);

export const categoriesQuery = defineQuery(
  `*[_type == "category"] | order(coalesce(order, 999) asc, title.ru asc){_id, _type, title, slug, order}`
);

export const servicesQuery = defineQuery(
  `*[_type == "service" && visible != false && defined(slug.current)] | order(coalesce(order, 999) asc){${serviceCard}}`
);

export const serviceBySlugQuery = defineQuery(
  `*[_type == "service" && slug.current == $slug && visible != false][0]{${serviceCard}, blocks, seo}`
);

export const reviewsQuery = defineQuery(
  `*[_type == "review"] | order(_createdAt desc)[0...12]{_id, _type, name, text, rating, photo, "service": service->{title, slug}}`
);

export const faqQuery = defineQuery(`*[_type == "faqItem"] | order(coalesce(order, 999) asc){_id, _type, question, answer, order}`);

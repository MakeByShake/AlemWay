// Shapes of the content coming from Sanity (and from the local fallback in src/content/seed.ts).

export type LocaleString = { ru?: string; kk?: string };
export type LocaleText = { ru?: string; kk?: string };
export type Keyed<T> = T & { _key: string };

export type SanityImage = {
  _type?: "image";
  asset?: { _ref?: string; _type?: string };
  alt?: LocaleString;
  hotspot?: unknown;
  crop?: unknown;
};

export type Slug = { current: string };

export type Seo = {
  title?: LocaleString;
  description?: LocaleText;
  image?: SanityImage;
};

export type Category = {
  _id: string;
  _type: "category";
  title: LocaleString;
  slug: Slug;
  order?: number;
};

// ---------- Page builder blocks ----------
export type RichTextBlock = { _type: "richText"; _key: string; title?: LocaleString; body?: LocaleText };
export type FeaturesBlock = { _type: "features"; _key: string; title?: LocaleString; items?: Keyed<LocaleString>[] };
export type DocumentsBlock = {
  _type: "documents";
  _key: string;
  title?: LocaleString;
  items?: Keyed<LocaleString>[];
  note?: LocaleText;
};
export type StepsBlock = {
  _type: "steps";
  _key: string;
  title?: LocaleString;
  items?: Keyed<{ title?: LocaleString; text?: LocaleText }>[];
};
export type PricingBlock = {
  _type: "pricing";
  _key: string;
  title?: LocaleString;
  plans?: Keyed<{ name?: LocaleString; price?: number; priceOnRequest?: boolean; features?: Keyed<LocaleString>[] }>[];
};
export type FaqBlock = {
  _type: "faq";
  _key: string;
  title?: LocaleString;
  items?: Keyed<{ question?: LocaleString; answer?: LocaleText }>[];
};
export type ImageTextBlock = {
  _type: "imageText";
  _key: string;
  title?: LocaleString;
  body?: LocaleText;
  image?: SanityImage;
  imagePosition?: "left" | "right";
};
export type GalleryBlock = { _type: "gallery"; _key: string; title?: LocaleString; images?: Keyed<SanityImage>[] };
export type CtaBlock = {
  _type: "cta";
  _key: string;
  title?: LocaleString;
  text?: LocaleText;
  buttonLabel?: LocaleString;
  showWhatsapp?: boolean;
};
export type AlertBlock = {
  _type: "alert";
  _key: string;
  tone?: "warning" | "info";
  title?: LocaleString;
  body?: LocaleText;
};
export type StatsBlock = {
  _type: "stats";
  _key: string;
  title?: LocaleString;
  items?: Keyed<{ value?: string; label?: LocaleString }>[];
};

export type PageBlock =
  | RichTextBlock
  | FeaturesBlock
  | DocumentsBlock
  | StepsBlock
  | PricingBlock
  | FaqBlock
  | ImageTextBlock
  | GalleryBlock
  | CtaBlock
  | AlertBlock
  | StatsBlock;

export type Service = {
  _id: string;
  _type: "service";
  title: LocaleString;
  slug: Slug;
  category?: Category | null;
  countryCode?: string;
  flagImage?: SanityImage;
  coverImage?: SanityImage;
  excerpt?: LocaleText;
  badge?: LocaleString;
  price?: number;
  priceOnRequest?: boolean;
  duration?: LocaleString;
  whatsappText?: LocaleString;
  order?: number;
  visible?: boolean;
  popular?: boolean;
  blocks?: PageBlock[];
  seo?: Seo;
};

export type Review = {
  _id: string;
  _type: "review";
  name: string;
  service?: { title?: LocaleString; slug?: Slug } | null;
  text?: LocaleText;
  rating?: number;
  photo?: SanityImage;
};

export type FaqItem = {
  _id: string;
  _type: "faqItem";
  question?: LocaleString;
  answer?: LocaleText;
  order?: number;
};

export type SiteSettings = {
  _id: "siteSettings";
  _type: "siteSettings";
  title?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: LocaleString;
  workingHours?: LocaleString;
  instagram?: string;
  stats?: Keyed<{ value?: string; label?: LocaleString }>[];
  heroTitle?: LocaleString;
  heroSubtitle?: LocaleText;
  heroImage?: SanityImage;
  aboutText?: LocaleText;
  aboutImage?: SanityImage;
  officeImage?: SanityImage;
  seoDescription?: LocaleText;
  ogImage?: SanityImage;
};

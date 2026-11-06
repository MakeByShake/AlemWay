import { defineArrayMember, defineField, defineType } from "sanity";
import { Briefcase, Folder, HelpCircle, Inbox, MessageSquareQuote, Settings } from "lucide-react";
import { pageBlocks } from "./blocks";
import { photoFields } from "./locale";
import { COUNTRY_OPTIONS } from "../../lib/countries";


export const siteSettings = defineType({
  name: "siteSettings",
  title: "Настройки сайта",
  type: "document",
  icon: Settings,
  groups: [
    { name: "contacts", title: "Контакты", default: true },
    { name: "home", title: "Главная" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({ name: "title", title: "Название компании", type: "string", group: "contacts" }),
    defineField({ name: "phone", title: "Телефон (как показывать)", type: "string", group: "contacts", description: "Например: +7 708 070 18 77" }),
    defineField({
      name: "whatsapp",
      title: "Номер WhatsApp",
      type: "string",
      group: "contacts",
      description: "Только цифры, без + и пробелов. Например: 77080701877",
      validation: (r) => r.regex(/^\d{10,15}$/, { name: "цифры" }),
    }),
    defineField({ name: "email", title: "Email", type: "string", group: "contacts" }),
    defineField({ name: "address", title: "Адрес", type: "localeString", group: "contacts" }),
    defineField({ name: "workingHours", title: "Время работы", type: "localeString", group: "contacts" }),
    defineField({ name: "instagram", title: "Instagram (без @)", type: "string", group: "contacts" }),
    defineField({ name: "heroTitle", title: "Главный заголовок", type: "localeString", group: "home" }),
    defineField({ name: "heroTitleAccent", title: "Заголовок — выделенная часть", type: "localeString", group: "home", description: "Показывается цветом после основного заголовка. Например: «без лишней беготни»." }),
    defineField({ name: "heroSubtitle", title: "Подзаголовок", type: "localeText", group: "home" }),
    defineField({ name: "heroImage", title: "Фото на главной", type: "image", group: "home", options: { hotspot: true }, fields: photoFields, description: "Реальное фото офиса или команды. Не стоковое." }),
    defineField({
      name: "stats",
      title: "Цифры доверия",
      type: "array",
      group: "home",
      of: [
        defineArrayMember({
          type: "object",
          name: "stat",
          fields: [
            defineField({ name: "value", title: "Число", type: "string" }),
            defineField({ name: "label", title: "Подпись", type: "localeString" }),
          ],
          preview: { select: { title: "value", subtitle: "label.ru" } },
        }),
      ],
    }),
    defineField({ name: "aboutText", title: "Текст «О нас»", type: "localeText", group: "home" }),
    defineField({ name: "aboutImage", title: "Фото для «О нас»", type: "image", group: "home", options: { hotspot: true }, fields: photoFields }),
    defineField({ name: "officeImage", title: "Фото офиса (контакты)", type: "image", group: "home", options: { hotspot: true }, fields: photoFields }),
    defineField({ name: "seoDescription", title: "Описание сайта для Google", type: "localeText", group: "seo" }),
    defineField({ name: "ogImage", title: "Картинка для соцсетей по умолчанию", type: "image", group: "seo", description: "1200×630" }),
  ],
  preview: { prepare: () => ({ title: "Настройки сайта" }) },
});

export const category = defineType({
  name: "category",
  title: "Категория",
  type: "document",
  icon: Folder,
  fields: [
    defineField({ name: "title", title: "Название", type: "localeString", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Адрес (slug)",
      type: "slug",
      options: { source: "title.ru" },
      description: "Латиницей, например: visas",
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", title: "Порядок", type: "number", description: "Меньше = выше." }),
  ],
  orderings: [{ title: "По порядку", name: "orderAsc", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "title.ru", subtitle: "title.kk" } },
});

export const service = defineType({
  name: "service",
  title: "Услуга",
  type: "document",
  icon: Briefcase,
  groups: [
    { name: "main", title: "Основное", default: true },
    { name: "page", title: "Страница" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({ name: "title", title: "Название", type: "localeString", group: "main", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Адрес страницы (slug)",
      type: "slug",
      group: "main",
      options: { source: "title.ru" },
      description: "Латиницей через дефис, например: visa-australia. После публикации лучше не менять — сломаются старые ссылки.",
      validation: (r) => r.required(),
    }),
    defineField({ name: "category", title: "Категория", type: "reference", to: [{ type: "category" }], group: "main", validation: (r) => r.required() }),
    defineField({
      name: "countryCode",
      title: "Флаг страны",
      type: "string",
      group: "main",
      options: { list: COUNTRY_OPTIONS },
      description: "Если нужной страны нет в списке — загрузите картинку флага ниже.",
    }),
    defineField({ name: "flagImage", title: "Флаг картинкой (необязательно)", type: "image", group: "main" }),
    defineField({ name: "coverImage", title: "Обложка", type: "image", group: "main", options: { hotspot: true }, fields: photoFields }),
    defineField({ name: "excerpt", title: "Короткое описание", type: "localeText", group: "main", description: "1–2 предложения для карточки." }),
    defineField({ name: "badge", title: "Метка на карточке", type: "localeString", group: "main", description: "Например: «Предрегистрация» или «Скоро подробнее». Можно оставить пустым." }),
    defineField({
      name: "priceOnRequest",
      title: "Цена по запросу",
      type: "boolean",
      group: "main",
      initialValue: false,
      description: "Включите, если цену называет менеджер.",
    }),
    defineField({
      name: "price",
      title: "Цена, ₸",
      type: "number",
      group: "main",
      hidden: ({ parent }) => Boolean(parent?.priceOnRequest),
      validation: (r) => r.min(0),
    }),
    defineField({ name: "duration", title: "Срок", type: "localeString", group: "main" }),
    defineField({ name: "whatsappText", title: "Текст сообщения в WhatsApp", type: "localeString", group: "main", description: "С этим текстом откроется чат по кнопке WhatsApp." }),
    defineField({ name: "order", title: "Порядок", type: "number", group: "main", description: "Меньше = выше." }),
    defineField({ name: "visible", title: "Показывать на сайте", type: "boolean", group: "main", initialValue: true }),
    defineField({ name: "popular", title: "Популярное", type: "boolean", group: "main", initialValue: false }),
    defineField({
      name: "blocks",
      title: "Блоки страницы",
      type: "array",
      group: "page",
      description: "Соберите страницу из блоков. Их можно перетаскивать. Форма заявки и похожие услуги добавляются автоматически.",
      of: pageBlocks.map((b) => defineArrayMember({ type: b.name })),
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  orderings: [{ title: "По порядку", name: "orderAsc", by: [{ field: "order", direction: "asc" }] }],
  preview: {
    select: { title: "title.ru", category: "category.title.ru", visible: "visible", media: "coverImage" },
    prepare: ({ title, category, visible, media }) => ({
      title,
      subtitle: `${category ?? "без категории"}${visible === false ? " · скрыта" : ""}`,
      media,
    }),
  },
});

export const review = defineType({
  name: "review",
  title: "Отзыв",
  type: "document",
  icon: MessageSquareQuote,
  fields: [
    defineField({ name: "name", title: "Имя клиента", type: "string", validation: (r) => r.required() }),
    defineField({ name: "service", title: "Услуга", type: "reference", to: [{ type: "service" }] }),
    defineField({ name: "text", title: "Текст отзыва", type: "localeText" }),
    defineField({ name: "rating", title: "Оценка (1–5)", type: "number", initialValue: 5, validation: (r) => r.min(1).max(5) }),
    defineField({ name: "photo", title: "Фото (необязательно)", type: "image", options: { hotspot: true } }),
  ],
  preview: { select: { title: "name", subtitle: "text.ru", media: "photo" } },
});

export const faqItem = defineType({
  name: "faqItem",
  title: "Вопрос (главная)",
  type: "document",
  icon: HelpCircle,
  fields: [
    defineField({ name: "question", title: "Вопрос", type: "localeString", validation: (r) => r.required() }),
    defineField({ name: "answer", title: "Ответ", type: "localeText" }),
    defineField({ name: "order", title: "Порядок", type: "number" }),
  ],
  orderings: [{ title: "По порядку", name: "orderAsc", by: [{ field: "order", direction: "asc" }] }],
  preview: { select: { title: "question.ru" } },
});

export const LEAD_STATUSES = [
  { title: "🆕 Новая", value: "new" },
  { title: "⏳ В работе", value: "in_progress" },
  { title: "💰 Оплачено", value: "paid" },
  { title: "✅ Закрыто", value: "closed" },
];

export const lead = defineType({
  name: "lead",
  title: "Заявка",
  type: "document",
  icon: Inbox,
  fields: [
    defineField({
      name: "status",
      title: "Статус",
      type: "string",
      options: { list: LEAD_STATUSES, layout: "radio", direction: "horizontal" },
      initialValue: "new",
    }),
    defineField({ name: "name", title: "Имя", type: "string", readOnly: true }),
    defineField({ name: "phone", title: "Телефон", type: "string", readOnly: true }),
    defineField({ name: "service", title: "Услуга", type: "reference", to: [{ type: "service" }], weak: true, readOnly: true }),
    defineField({ name: "serviceTitle", title: "Услуга (как выбрал клиент)", type: "string", readOnly: true }),
    defineField({ name: "comment", title: "Комментарий клиента", type: "text", rows: 3, readOnly: true }),
    defineField({ name: "locale", title: "Язык сайта", type: "string", readOnly: true }),
    defineField({ name: "page", title: "Страница", type: "string", readOnly: true }),
    defineField({
      name: "utm",
      title: "UTM-метки",
      type: "object",
      readOnly: true,
      options: { collapsible: true, collapsed: true },
      fields: ["source", "medium", "campaign", "term", "content"].map((n) => defineField({ name: n, title: n, type: "string" })),
    }),
    defineField({ name: "createdAt", title: "Дата", type: "datetime", readOnly: true }),
    defineField({ name: "managerNote", title: "Заметка менеджера", type: "text", rows: 3 }),
  ],
  orderings: [{ title: "Сначала новые", name: "createdDesc", by: [{ field: "createdAt", direction: "desc" }] }],
  preview: {
    select: { name: "name", phone: "phone", service: "serviceTitle", status: "status", createdAt: "createdAt" },
    prepare: ({ name, phone, service, status, createdAt }) => {
      const s = LEAD_STATUSES.find((x) => x.value === status)?.title ?? "🆕 Новая";
      const date = createdAt ? new Date(createdAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "";
      return { title: `${s} · ${name ?? "Без имени"}`, subtitle: [phone, service, date].filter(Boolean).join(" · ") };
    },
  },
});

import { defineArrayMember, defineField, defineType } from "sanity";
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Images,
  ListChecks,
  ListOrdered,
  Megaphone,
  Tags,
} from "lucide-react";

const title = defineField({ name: "title", title: "Заголовок", type: "localeString" });

const previewWith = (label: string) => ({
  select: { title: "title.ru" },
  prepare: ({ title }: { title?: string }) => ({ title: title || label, subtitle: label }),
});

export const richTextBlock = defineType({
  name: "richText",
  title: "Текст",
  type: "object",
  icon: FileText,
  fields: [title, defineField({ name: "body", title: "Текст", type: "localeText" })],
  preview: previewWith("Текст"),
});

export const featuresBlock = defineType({
  name: "features",
  title: "Что входит (галочки)",
  type: "object",
  icon: CheckSquare,
  fields: [
    title,
    defineField({ name: "items", title: "Пункты", type: "array", of: [defineArrayMember({ type: "localeString" })] }),
  ],
  preview: previewWith("Что входит"),
});

export const documentsBlock = defineType({
  name: "documents",
  title: "Документы (чек-лист)",
  type: "object",
  icon: ListChecks,
  fields: [
    title,
    defineField({ name: "items", title: "Документы", type: "array", of: [defineArrayMember({ type: "localeString" })] }),
    defineField({ name: "note", title: "Примечание под списком", type: "localeText" }),
  ],
  preview: previewWith("Документы"),
});

export const stepsBlock = defineType({
  name: "steps",
  title: "Шаги",
  type: "object",
  icon: ListOrdered,
  fields: [
    title,
    defineField({
      name: "items",
      title: "Шаги",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "step",
          fields: [
            defineField({ name: "title", title: "Заголовок шага", type: "localeString" }),
            defineField({ name: "text", title: "Описание", type: "localeText" }),
          ],
          preview: { select: { title: "title.ru", subtitle: "text.ru" } },
        }),
      ],
    }),
  ],
  preview: previewWith("Шаги"),
});

export const pricingBlock = defineType({
  name: "pricing",
  title: "Тарифы",
  type: "object",
  icon: Tags,
  fields: [
    title,
    defineField({
      name: "plans",
      title: "Тарифы",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "plan",
          fields: [
            defineField({ name: "name", title: "Название", type: "localeString" }),
            defineField({ name: "price", title: "Цена, ₸", type: "number" }),
            defineField({ name: "priceOnRequest", title: "Цена по запросу", type: "boolean", initialValue: false }),
            defineField({ name: "features", title: "Что входит", type: "array", of: [defineArrayMember({ type: "localeString" })] }),
          ],
          preview: { select: { title: "name.ru", subtitle: "price" } },
        }),
      ],
    }),
  ],
  preview: previewWith("Тарифы"),
});

export const faqBlock = defineType({
  name: "faq",
  title: "Вопросы и ответы",
  type: "object",
  icon: HelpCircle,
  fields: [
    title,
    defineField({
      name: "items",
      title: "Вопросы",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "qa",
          fields: [
            defineField({ name: "question", title: "Вопрос", type: "localeString" }),
            defineField({ name: "answer", title: "Ответ", type: "localeText" }),
          ],
          preview: { select: { title: "question.ru" } },
        }),
      ],
    }),
  ],
  preview: previewWith("Вопросы и ответы"),
});

export const imageTextBlock = defineType({
  name: "imageText",
  title: "Фото + текст",
  type: "object",
  icon: ImageIcon,
  fields: [
    title,
    defineField({ name: "body", title: "Текст", type: "localeText" }),
    defineField({
      name: "image",
      title: "Фото",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Описание фото (для незрячих и Google)", type: "localeString" })],
    }),
    defineField({
      name: "imagePosition",
      title: "Фото",
      type: "string",
      options: { list: [{ title: "Слева", value: "left" }, { title: "Справа", value: "right" }], layout: "radio" },
      initialValue: "left",
    }),
  ],
  preview: { select: { title: "title.ru", media: "image" }, prepare: ({ title, media }) => ({ title: title || "Фото + текст", subtitle: "Фото + текст", media }) },
});

export const galleryBlock = defineType({
  name: "gallery",
  title: "Галерея",
  type: "object",
  icon: Images,
  fields: [
    title,
    defineField({
      name: "images",
      title: "Фото",
      type: "array",
      options: { layout: "grid" },
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [defineField({ name: "alt", title: "Описание фото", type: "localeString" })],
        }),
      ],
    }),
  ],
  preview: previewWith("Галерея"),
});

export const ctaBlock = defineType({
  name: "cta",
  title: "Призыв к действию",
  type: "object",
  icon: Megaphone,
  fields: [
    title,
    defineField({ name: "text", title: "Текст", type: "localeText" }),
    defineField({ name: "buttonLabel", title: "Текст кнопки заявки", type: "localeString", description: "Если пусто — «Оставить заявку»." }),
    defineField({ name: "showWhatsapp", title: "Показать кнопку WhatsApp", type: "boolean", initialValue: true }),
  ],
  preview: previewWith("Призыв к действию"),
});

export const alertBlock = defineType({
  name: "alert",
  title: "Важное предупреждение",
  type: "object",
  icon: AlertTriangle,
  fields: [
    defineField({
      name: "tone",
      title: "Тип",
      type: "string",
      options: { list: [{ title: "Внимание (жёлтый)", value: "warning" }, { title: "Информация (синий)", value: "info" }], layout: "radio" },
      initialValue: "warning",
    }),
    title,
    defineField({ name: "body", title: "Текст", type: "localeText" }),
  ],
  preview: previewWith("Предупреждение"),
});

export const statsBlock = defineType({
  name: "stats",
  title: "Цифры",
  type: "object",
  icon: BarChart3,
  fields: [
    title,
    defineField({
      name: "items",
      title: "Цифры",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "stat",
          fields: [
            defineField({ name: "value", title: "Число", type: "string", description: "Например: 60, 1000+, ~3 года" }),
            defineField({ name: "label", title: "Подпись", type: "localeString" }),
          ],
          preview: { select: { title: "value", subtitle: "label.ru" } },
        }),
      ],
    }),
  ],
  preview: previewWith("Цифры"),
});

export const pageBlocks = [
  richTextBlock,
  featuresBlock,
  documentsBlock,
  stepsBlock,
  pricingBlock,
  faqBlock,
  imageTextBlock,
  galleryBlock,
  ctaBlock,
  alertBlock,
  statsBlock,
];

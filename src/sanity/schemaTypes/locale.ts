import { defineField, defineType } from "sanity";

const KK_HINT = "Казахский. Проверить носителем языка.";

export const localeString = defineType({
  name: "localeString",
  title: "Текст (RU / KZ)",
  type: "object",
  options: { columns: 2 },
  fields: [
    defineField({ name: "ru", title: "Русский", type: "string" }),
    defineField({ name: "kk", title: "Қазақша", type: "string", description: KK_HINT }),
  ],
  preview: { select: { title: "ru", subtitle: "kk" } },
});

export const localeText = defineType({
  name: "localeText",
  title: "Длинный текст (RU / KZ)",
  type: "object",
  fields: [
    defineField({
      name: "ru",
      title: "Русский",
      type: "text",
      rows: 4,
      description: "Пустая строка между абзацами = новый абзац.",
    }),
    defineField({ name: "kk", title: "Қазақша", type: "text", rows: 4, description: KK_HINT }),
  ],
  preview: { select: { title: "ru", subtitle: "kk" } },
});

export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({ name: "title", title: "Заголовок для Google", type: "localeString", description: "До 60 символов." }),
    defineField({ name: "description", title: "Описание для Google", type: "localeText", description: "До 160 символов." }),
    defineField({ name: "image", title: "Картинка для соцсетей", type: "image", description: "1200×630." }),
  ],
});


/** Fields for every photo: description + author credit. */
export const photoFields = [
  defineField({ name: "alt", title: "Описание фото (для незрячих и Google)", type: "localeString" }),
  defineField({ name: "credit", title: "Автор фото", type: "string", description: "Если фото чужое по свободной лицензии, например: «Фото: Иван Иванов, CC BY 4.0». Своё фото — оставьте пустым." }),
];

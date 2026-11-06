import { defineField, defineType } from "sanity";
import { MessageCircleHeart } from "lucide-react";
import { FEEDBACK_STATUSES } from "../../lib/feedback";

const TOPICS = [
  { title: "Сайт", value: "site" },
  { title: "Наша работа", value: "service" },
  { title: "Другое", value: "other" },
];

/** Private feedback from visitors (created by the server only, never shown on the site). */
export const feedback = defineType({
  name: "feedback",
  title: "Отзыв о сайте",
  type: "document",
  icon: MessageCircleHeart,
  fields: [
    defineField({
      name: "status",
      title: "Статус",
      type: "string",
      options: { list: FEEDBACK_STATUSES, layout: "radio", direction: "horizontal" },
      initialValue: "new",
    }),
    defineField({ name: "rating", title: "Оценка (1–5)", type: "number", readOnly: true }),
    defineField({ name: "topic", title: "О чём отзыв", type: "string", options: { list: TOPICS }, readOnly: true }),
    defineField({ name: "liked", title: "Что понравилось", type: "text", rows: 3, readOnly: true }),
    defineField({ name: "improve", title: "Что улучшить", type: "text", rows: 3, readOnly: true }),
    defineField({ name: "name", title: "Имя", type: "string", readOnly: true }),
    defineField({ name: "contact", title: "Контакт", type: "string", readOnly: true }),
    defineField({ name: "locale", title: "Язык сайта", type: "string", readOnly: true }),
    defineField({ name: "page", title: "Страница", type: "string", readOnly: true }),
    defineField({ name: "createdAt", title: "Дата", type: "datetime", readOnly: true }),
    defineField({ name: "managerNote", title: "Заметка команды", type: "text", rows: 3, description: "Что решили сделать по этому отзыву." }),
  ],
  orderings: [{ title: "Сначала новые", name: "createdDesc", by: [{ field: "createdAt", direction: "desc" }] }],
  preview: {
    select: { rating: "rating", topic: "topic", improve: "improve", liked: "liked", status: "status", createdAt: "createdAt" },
    prepare: ({ rating, topic, improve, liked, status, createdAt }) => {
      const stars = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "—";
      const s = FEEDBACK_STATUSES.find((x) => x.value === status)?.title ?? "🆕 Новый";
      const date = createdAt ? new Date(createdAt).toLocaleDateString("ru-RU") : "";
      const t = TOPICS.find((x) => x.value === topic)?.title ?? "";
      return { title: `${stars} · ${t}`, subtitle: [s, date, improve || liked].filter(Boolean).join(" · ") };
    },
  },
});

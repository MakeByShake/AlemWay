/** Feedback form options, shared by the form, the API and the admin schema. */
export const FEEDBACK_TOPICS = ["site", "service", "other"] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export const FEEDBACK_STATUSES = [
  { title: "🆕 Новый", value: "new" },
  { title: "👀 Прочитан", value: "read" },
  { title: "✅ Сделано", value: "done" },
];

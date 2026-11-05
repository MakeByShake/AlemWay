import { defineField, defineType } from "sanity";
import { UserRound } from "lucide-react";
import { CABINET_SECTIONS, CABINET_STATUSES, FILE_KINDS, FILE_LABELS } from "../../lib/cabinet/fields";
import { CabinetFilesInput } from "../cabinet/CabinetFilesInput";

/**
 * Personal cabinet of a Ferienjob client.
 * Documents are created by the server with an _id "cabinets.<uuid>": in a public dataset such ids are not
 * readable without a token, so client data stays private. Never create cabinets with a plain id.
 */
export const cabinet = defineType({
  name: "cabinet",
  title: "Личный кабинет",
  type: "document",
  icon: UserRound,
  groups: [
    { name: "main", title: "Клиент", default: true },
    { name: "data", title: "Анкета" },
    { name: "files", title: "Файлы" },
  ],
  fields: [
    defineField({
      name: "status",
      title: "Статус",
      type: "string",
      group: "main",
      options: { list: CABINET_STATUSES.map((s) => ({ title: s.title, value: s.value })), layout: "radio" },
      initialValue: "waiting_data",
    }),
    defineField({ name: "clientName", title: "Имя клиента (для менеджера)", type: "string", group: "main" }),
    defineField({ name: "clientPhone", title: "Телефон клиента", type: "string", group: "main" }),
    defineField({ name: "managerNote", title: "Заметка менеджера", type: "text", rows: 3, group: "main" }),
    defineField({
      name: "linkCreatedAt",
      title: "Ссылка для входа создана",
      type: "datetime",
      group: "main",
      readOnly: true,
      description: "Ссылку видно только при создании. Потеряли — нажмите «Новая ссылка для клиента» в меню действий (старая перестанет работать).",
    }),
    defineField({ name: "tokenHash", title: "Хэш ключа входа", type: "string", hidden: true, readOnly: true }),
    defineField({ name: "lead", title: "Заявка", type: "reference", to: [{ type: "lead" }], weak: true, group: "main", readOnly: true }),
    defineField({ name: "submittedAt", title: "Клиент отправил анкету", type: "datetime", group: "main", readOnly: true }),
    defineField({ name: "signedAt", title: "Клиент загрузил подписанную декларацию", type: "datetime", group: "main", readOnly: true }),

    defineField({
      name: "data",
      title: "Анкета клиента",
      type: "object",
      group: "data",
      description: "Можно исправить ошибку клиента, опубликовать и нажать «Пересоздать декларацию».",
      fieldsets: CABINET_SECTIONS.map((s) => ({ name: s.id, title: s.title.ru, options: { collapsible: true, collapsed: false } })),
      fields: CABINET_SECTIONS.flatMap((s) =>
        s.fields.map((f) => {
          const base = { name: f.key, title: f.label.ru, fieldset: s.id };
          if (f.kind === "date") return defineField({ ...base, type: "date", options: { dateFormat: "DD.MM.YYYY" } });
          if (f.kind === "yesno") {
            return defineField({
              ...base,
              type: "string",
              options: { list: [{ title: "Да", value: "yes" }, { title: "Нет", value: "no" }], layout: "radio", direction: "horizontal" },
            });
          }
          return defineField({ ...base, type: "string" });
        })
      ),
    }),

    defineField({
      name: "files",
      title: "Файлы",
      type: "object",
      group: "files",
      readOnly: true,
      components: { input: CabinetFilesInput },
      fields: FILE_KINDS.map((kind) =>
        defineField({
          name: kind,
          title: FILE_LABELS[kind].ru,
          type: "object",
          fields: [
            defineField({ name: "path", title: "Путь в хранилище", type: "string" }),
            defineField({ name: "name", title: "Имя файла", type: "string" }),
            defineField({ name: "contentType", title: "Тип", type: "string" }),
            defineField({ name: "size", title: "Размер", type: "number" }),
            defineField({ name: "uploadedAt", title: "Загружен", type: "datetime" }),
          ],
        })
      ),
    }),
    defineField({ name: "declarationDate", title: "Дата в декларации", type: "date", group: "files", readOnly: true }),
  ],
  orderings: [{ title: "Сначала новые", name: "createdDesc", by: [{ field: "_createdAt", direction: "desc" }] }],
  preview: {
    select: { name: "clientName", first: "data.firstName", last: "data.lastName", status: "status", phone: "clientPhone" },
    prepare: ({ name, first, last, status, phone }) => {
      const s = CABINET_STATUSES.find((x) => x.value === status)?.title ?? CABINET_STATUSES[0].title;
      const who = [first, last].filter(Boolean).join(" ") || name || "Без имени";
      return { title: who, subtitle: [s, phone].filter(Boolean).join(" · ") };
    },
  },
});

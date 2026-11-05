import { defineField, defineType } from "sanity";
import { UserRound } from "lucide-react";
import { ALL_FIELDS, CABINET_STATUSES, FILE_KINDS, FILE_LABELS, SERVICE_TITLES, fieldsFor, serviceOf } from "../../lib/cabinet/fields";

type Doc = { document?: Record<string, unknown> };
const isKeta = ({ document }: Doc) => serviceOf(document?.service as string | undefined) === "keta";
const isFerienjob = (ctx: Doc) => !isKeta(ctx);
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
    { name: "zav", title: "ZAV и контракт", hidden: isKeta },
    { name: "keta", title: "K-ETA", hidden: isFerienjob },
  ],
  fields: [
    defineField({
      name: "service",
      title: "Услуга",
      type: "string",
      group: "main",
      options: {
        list: [
          { title: SERVICE_TITLES.ferienjob.ru, value: "ferienjob" },
          { title: SERVICE_TITLES.keta.ru, value: "keta" },
        ],
        layout: "radio",
      },
      initialValue: "ferienjob",
      description: "Задаётся при создании кабинета. От неё зависят анкета, файлы и шаги у клиента.",
    }),
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

    // --- ZAV / contract: shown to the client once ZAV is uploaded (tab «Файлы» → «Загрузить ZAV»). ---
    defineField({
      name: "employerName",
      title: "Работодатель в Германии",
      type: "string",
      group: "zav", hidden: isKeta,
      description: "Клиент увидит это в кабинете после загрузки ZAV.",
    }),
    defineField({ name: "workCity", title: "Город работы", type: "string", group: "zav", hidden: isKeta }),
    defineField({ name: "workPosition", title: "Должность / работа", type: "string", group: "zav", hidden: isKeta }),
    defineField({ name: "workFrom", title: "Работа с", type: "date", group: "zav", hidden: isKeta, options: { dateFormat: "DD.MM.YYYY" } }),
    defineField({ name: "workTo", title: "Работа по", type: "date", group: "zav", hidden: isKeta, options: { dateFormat: "DD.MM.YYYY" } }),
    defineField({
      name: "clientMessage",
      title: "Сообщение клиенту",
      type: "text",
      rows: 4,
      group: ["zav", "keta"],
      description: "Что делать дальше (запись в посольство, документы, правила въезда и т. п.). Показывается в кабинете клиента.",
    }),
    defineField({ name: "zavReceivedAt", title: "ZAV загружен", type: "datetime", group: "zav", hidden: isKeta, readOnly: true }),
    defineField({ name: "signedAt", title: "Клиент загрузил подписанную декларацию", type: "datetime", group: "main", readOnly: true, hidden: isKeta }),
    defineField({
      name: "ketaValidUntil",
      title: "K-ETA действует до",
      type: "date",
      group: "keta",
      hidden: isFerienjob,
      options: { dateFormat: "DD.MM.YYYY" },
      description: "Из одобрения на k-eta.go.kr. 3 года, но не дольше паспорта. Клиент увидит эту дату.",
    }),

    defineField({
      name: "data",
      title: "Анкета клиента",
      type: "object",
      group: "data",
      description: "Можно исправить ошибку клиента и опубликовать. Для Ferienjob затем нажмите «Пересоздать декларацию».",
      // One list for both services; each field shows only in cabinets of the service that asks for it.
      fields: ALL_FIELDS.map((f) => {
        const base = {
          name: f.key,
          title: f.label.ru,
          hidden: ({ document }: Doc) => !fieldsFor(serviceOf(document?.service as string | undefined)).some((x) => x.key === f.key),
        };
        if (f.kind === "date") return defineField({ ...base, type: "date", options: { dateFormat: "DD.MM.YYYY" } });
        if (f.kind === "yesno") {
          return defineField({
            ...base,
            type: "string",
            options: { list: [{ title: "Да", value: "yes" }, { title: "Нет", value: "no" }], layout: "radio", direction: "horizontal" },
          });
        }
        if (f.kind === "select") {
          return defineField({ ...base, type: "string", options: { list: (f.options ?? []).map((o) => ({ title: o.label.ru, value: o.value })) } });
        }
        return defineField({ ...base, type: "string" });
      }),
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
    defineField({ name: "declarationDate", title: "Дата в декларации", type: "date", group: "files", readOnly: true, hidden: isKeta }),
  ],
  orderings: [{ title: "Сначала новые", name: "createdDesc", by: [{ field: "_createdAt", direction: "desc" }] }],
  preview: {
    select: { name: "clientName", first: "data.firstName", last: "data.lastName", status: "status", phone: "clientPhone", service: "service" },
    prepare: ({ name, first, last, status, phone, service }) => {
      const s = CABINET_STATUSES.find((x) => x.value === status)?.title ?? CABINET_STATUSES[0].title;
      const who = [first, last].filter(Boolean).join(" ") || name || "Без имени";
      const tag = serviceOf(service) === "keta" ? "🇰🇷 K-ETA" : "🇩🇪 Ferienjob";
      return { title: who, subtitle: [tag, s, phone].filter(Boolean).join(" · ") };
    },
  },
});

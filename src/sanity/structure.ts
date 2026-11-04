import type { StructureResolver } from "sanity/structure";
import { Briefcase, Folder, HelpCircle, Inbox, MessageSquareQuote, Settings } from "lucide-react";
import { LEAD_STATUSES } from "./schemaTypes/documents";

/** Left menu of the admin panel. The leads list id ("leads") is used in Telegram links. */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("AlemWay Visa")
    .items([
      S.listItem()
        .title("Заявки")
        .id("leads")
        .icon(Inbox)
        .child(
          S.list()
            .title("Заявки")
            .items([
              S.listItem()
                .title("Все заявки")
                .id("all")
                .child(S.documentTypeList("lead").title("Все заявки").defaultOrdering([{ field: "createdAt", direction: "desc" }])),
              S.divider(),
              ...LEAD_STATUSES.map((st) =>
                S.listItem()
                  .title(st.title)
                  .id(st.value)
                  .child(
                    S.documentList()
                      .title(st.title)
                      .schemaType("lead")
                      .filter(st.value === "new" ? `_type == "lead" && (status == "new" || !defined(status))` : `_type == "lead" && status == $status`)
                      .params({ status: st.value })
                      .defaultOrdering([{ field: "createdAt", direction: "desc" }])
                  )
              ),
            ])
        ),
      S.divider(),
      S.documentTypeListItem("service").title("Услуги").icon(Briefcase),
      S.documentTypeListItem("category").title("Категории").icon(Folder),
      S.documentTypeListItem("review").title("Отзывы").icon(MessageSquareQuote),
      S.documentTypeListItem("faqItem").title("FAQ (главная)").icon(HelpCircle),
      S.divider(),
      S.listItem()
        .title("Настройки сайта")
        .id("settings")
        .icon(Settings)
        .child(S.document().schemaType("siteSettings").documentId("siteSettings").title("Настройки сайта")),
    ]);

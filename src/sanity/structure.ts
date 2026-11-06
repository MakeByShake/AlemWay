import type { StructureResolver } from "sanity/structure";
import { Briefcase, Folder, HelpCircle, Inbox, MessageCircleHeart, MessageSquareQuote, Settings, UserPlus, UserRound } from "lucide-react";
import { LEAD_STATUSES } from "./schemaTypes/documents";
import { CABINET_STATUSES } from "../lib/cabinet/fields";
import { NewCabinetPane } from "./cabinet/NewCabinetPane";

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
                      .apiVersion("2025-10-01")
                      .schemaType("lead")
                      .filter(st.value === "new" ? `_type == "lead" && (status == "new" || !defined(status))` : `_type == "lead" && status == $status`)
                      .params({ status: st.value })
                      .defaultOrdering([{ field: "createdAt", direction: "desc" }])
                  )
              ),
            ])
        ),
      S.listItem()
        .title("Личные кабинеты")
        .id("cabinets")
        .icon(UserRound)
        .child(
          S.list()
            .title("Личные кабинеты")
            .items([
              S.listItem().title("Новый кабинет").id("new").icon(UserPlus).child(S.component(NewCabinetPane).id("new-cabinet").title("Новый кабинет")),
              S.divider(),
              S.listItem()
                .title("Все кабинеты")
                .id("all")
                .child(S.documentTypeList("cabinet").title("Все кабинеты").initialValueTemplates([])),
              ...(["ferienjob", "keta"] as const).map((sv) =>
                S.listItem()
                  .title(sv === "keta" ? "🇰🇷 K-ETA" : "🇩🇪 Ferienjob")
                  .id(sv)
                  .child(
                    S.documentList()
                      .apiVersion("2025-10-01")
                      .title(sv === "keta" ? "K-ETA" : "Ferienjob")
                      .schemaType("cabinet")
                      .filter(sv === "keta" ? `_type == "cabinet" && service == "keta"` : `_type == "cabinet" && (service == "ferienjob" || !defined(service))`)
                      .initialValueTemplates([])
                  )
              ),
              S.divider(),
              ...CABINET_STATUSES.map((st) =>
                S.listItem()
                  .title(st.title)
                  .id(st.value)
                  .child(
                    S.documentList()
                      .title(st.title)
                      .apiVersion("2025-10-01")
                      .schemaType("cabinet")
                      .filter(
                        st.value === "waiting_data"
                          ? `_type == "cabinet" && (status == $status || !defined(status))`
                          : `_type == "cabinet" && status == $status`
                      )
                      .params({ status: st.value })
                      .initialValueTemplates([])
                  )
              ),
            ])
        ),
      S.listItem()
        .title("Отзывы о сайте")
        .id("feedback")
        .icon(MessageCircleHeart)
        .child(
          S.documentList()
            .title("Отзывы о сайте")
            .apiVersion("2025-10-01")
            .schemaType("feedback")
            .filter(`_type == "feedback"`)
            .defaultOrdering([{ field: "createdAt", direction: "desc" }])
            .initialValueTemplates([])
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

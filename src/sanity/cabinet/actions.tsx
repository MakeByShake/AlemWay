import { useState } from "react";
import { Card, Stack, Text } from "@sanity/ui";
import { FileText as DocumentPdfIcon, Link2 as LinkIcon, UserRound as UserIcon } from "lucide-react";
import { IntentLink } from "sanity/router";
import type { DocumentActionComponent } from "sanity";
import { useAdminFetch } from "./adminApi";
import { LinkCard } from "./LinkCard";

type Dialog = { kind: "link"; link: string; phone?: string; id?: string } | { kind: "message"; text: string; tone: "positive" | "critical" };

function useActionState() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  return { dialog, setDialog, busy, setBusy };
}

function renderDialog(dialog: Dialog | null, close: () => void, header: string) {
  if (!dialog) return null;
  return {
    type: "dialog" as const,
    header,
    onClose: close,
    content:
      dialog.kind === "link" ? (
        <Stack gap={3}>
          <LinkCard link={dialog.link} phone={dialog.phone} />
          {dialog.id && (
            <Text size={1}>
              <IntentLink intent="edit" params={{ id: dialog.id, type: "cabinet" }}>
                Открыть карточку кабинета →
              </IntentLink>
            </Text>
          )}
        </Stack>
      ) : (
        <Card padding={3} radius={2} tone={dialog.tone}>
          <Text size={1}>{dialog.text}</Text>
        </Card>
      ),
  };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Cabinet: issue a new login link (the old one stops working). */
export const NewLinkAction: DocumentActionComponent = (props) => {
  const adminFetch = useAdminFetch();
  const { dialog, setDialog, busy, setBusy } = useActionState();
  const [confirm, setConfirm] = useState(false);
  const doc = (props.draft ?? props.published) as { clientPhone?: string } | null;

  return {
    label: "Новая ссылка для клиента",
    icon: LinkIcon,
    disabled: !props.published || busy,
    title: !props.published ? "Сначала опубликуйте кабинет" : undefined,
    onHandle: () => setConfirm(true),
    dialog: confirm
      ? {
          type: "confirm",
          tone: "caution",
          message: "Создать новую ссылку? Старая ссылка клиента перестанет работать.",
          onCancel: () => setConfirm(false),
          onConfirm: async () => {
            setConfirm(false);
            setBusy(true);
            try {
              const res = await adminFetch("/api/admin/cabinet/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: props.id }),
              });
              const j = (await res.json()) as { link: string };
              setDialog({ kind: "link", link: j.link, phone: doc?.clientPhone });
            } catch (e) {
              setDialog({ kind: "message", text: errText(e), tone: "critical" });
            } finally {
              setBusy(false);
            }
          },
        }
      : renderDialog(dialog, () => setDialog(null), "Ссылка для клиента"),
  };
};

/** Cabinet: rebuild the declaration PDF from the current questionnaire (e.g. after the manager fixed a typo). */
export const RegenerateDeclarationAction: DocumentActionComponent = (props) => {
  const adminFetch = useAdminFetch();
  const { dialog, setDialog, busy, setBusy } = useActionState();
  // Only Ferienjob cabinets have a ZAV declaration.
  const service = ((props.draft ?? props.published) as { service?: string } | null)?.service;
  if (service === "keta") return null;

  return {
    label: busy ? "Создаю декларацию…" : "Пересоздать декларацию",
    icon: DocumentPdfIcon,
    disabled: busy || Boolean(props.draft),
    title: props.draft ? "Сначала опубликуйте изменения" : undefined,
    onHandle: async () => {
      setBusy(true);
      try {
        await adminFetch("/api/admin/cabinet/declaration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: props.id }),
        });
        setDialog({ kind: "message", text: "Готово: новая декларация в кабинете клиента и во вкладке «Файлы».", tone: "positive" });
      } catch (e) {
        setDialog({ kind: "message", text: errText(e), tone: "critical" });
      } finally {
        setBusy(false);
      }
    },
    dialog: renderDialog(dialog, () => setDialog(null), "Декларация"),
  };
};

/** Lead: open a personal cabinet for this client (after payment). */
export const OpenCabinetFromLeadAction: DocumentActionComponent = (props) => {
  const adminFetch = useAdminFetch();
  const { dialog, setDialog, busy, setBusy } = useActionState();
  const lead = (props.published ?? props.draft) as { name?: string; phone?: string } | null;

  return {
    label: "Открыть личный кабинет",
    icon: UserIcon,
    disabled: !props.published || busy,
    onHandle: async () => {
      setBusy(true);
      try {
        const res = await adminFetch("/api/admin/cabinet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: props.id, clientName: lead?.name ?? "", clientPhone: lead?.phone ?? "" }),
        });
        const j = (await res.json()) as { id: string; link: string };
        setDialog({ kind: "link", link: j.link, phone: lead?.phone, id: j.id });
      } catch (e) {
        setDialog({ kind: "message", text: errText(e), tone: "critical" });
      } finally {
        setBusy(false);
      }
    },
    dialog: renderDialog(dialog, () => setDialog(null), "Личный кабинет создан"),
  };
};

import { useState } from "react";
import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { Download as DownloadIcon } from "lucide-react";
import { useFormValue, type ObjectInputProps } from "sanity";
import { FILE_KINDS, FILE_LABELS, type FileKind } from "../../lib/cabinet/fields";
import { useAdminFetch } from "./adminApi";

type StoredFile = { path?: string; name?: string; size?: number; uploadedAt?: string };

/** Shows the cabinet's private files with download buttons (files are served through the site, not public URLs). */
export function CabinetFilesInput(props: ObjectInputProps) {
  const id = String(useFormValue(["_id"]) ?? "").replace(/^drafts\./, "");
  const value = (props.value ?? {}) as Partial<Record<FileKind, StoredFile>>;
  const adminFetch = useAdminFetch();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: FileKind, name: string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Stack gap={2}>
      {FILE_KINDS.map((kind) => {
        const f = value[kind];
        return (
          <Card key={kind} padding={3} radius={2} border tone={f?.path ? "default" : "transparent"}>
            <Flex align="center" gap={3}>
              <Stack gap={2} flex={1}>
                <Text size={1} weight="semibold">
                  {FILE_LABELS[kind].ru}
                </Text>
                <Text size={1} muted>
                  {f?.path
                    ? `${f.name ?? "файл"} · ${f.size ? Math.round(f.size / 1024) + " КБ" : ""}${
                        f.uploadedAt ? " · " + new Date(f.uploadedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : ""
                      }`
                    : "Ещё нет"}
                </Text>
              </Stack>
              {f?.path && (
                <Button
                  icon={DownloadIcon}
                  text="Скачать"
                  mode="ghost"
                  loading={busy === kind}
                  onClick={() => download(kind, f.name ?? `${kind}.pdf`)}
                />
              )}
            </Flex>
          </Card>
        );
      })}
      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      )}
    </Stack>
  );
}

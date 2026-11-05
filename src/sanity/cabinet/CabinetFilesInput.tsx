import { useRef, useState } from "react";
import { Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { Download as DownloadIcon, Upload as UploadIcon } from "lucide-react";
import { useFormValue, type ObjectInputProps } from "sanity";
import { FILE_KINDS, FILE_LABELS, MANAGER_UPLOAD_KINDS, MAX_UPLOAD_BYTES, type FileKind } from "../../lib/cabinet/fields";
import { useAdminFetch } from "./adminApi";

type StoredFile = { path?: string; name?: string; size?: number; uploadedAt?: string };

// ZAV first: it is the file the manager adds; the rest come from the client or the site.
const ORDER: FileKind[] = ["zav", ...FILE_KINDS.filter((k) => k !== "zav")];
const canUpload = (k: FileKind) => (MANAGER_UPLOAD_KINDS as readonly FileKind[]).includes(k);

/**
 * Cabinet files in the Studio: download any private file, upload ZAV, replace a client's file.
 * Files go through the site's /api/admin endpoints, never through public URLs.
 */
export function CabinetFilesInput(props: ObjectInputProps) {
  const id = String(useFormValue(["_id"]) ?? "").replace(/^drafts\./, "");
  const clientPhone = useFormValue(["clientPhone"]);
  const dataPhone = useFormValue(["data", "phone"]);
  const phone = String(clientPhone || dataPhone || "");
  const value = (props.value ?? {}) as Partial<Record<FileKind, StoredFile>>;
  const adminFetch = useAdminFetch();
  const picker = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<FileKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zavJustUploaded, setZavJustUploaded] = useState(false);

  async function download(kind: FileKind, name: string) {
    setBusy(kind);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/cabinet/file?id=${encodeURIComponent(id)}&kind=${kind}`);
      const url = URL.createObjectURL(await res.blob());
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

  function pick(kind: FileKind) {
    if (kind !== "zav" && value[kind]?.path && !window.confirm(`Заменить «${FILE_LABELS[kind].ru}»? Старый файл удалится.`)) return;
    setTarget(kind);
    picker.current?.click();
  }

  async function upload(file: File) {
    if (!target) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) return setError("Файл больше 4 МБ — сожмите его.");
    setBusy(target);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await adminFetch(`/api/admin/cabinet/upload?id=${encodeURIComponent(id)}&kind=${target}`, { method: "POST", body: fd });
      if (target === "zav") setZavJustUploaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setTarget(null);
    }
  }

  const digits = phone.replace(/\D/g, "");
  const notify = `Здравствуйте! Ваш ZAV готов — контракт с работодателем подтверждён 🎉 Откройте личный кабинет AlemWay Visa: там ZAV и дальнейшие шаги.`;

  return (
    <Stack gap={2}>
      <input
        ref={picker}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      {ORDER.map((kind) => {
        const f = value[kind];
        const isZav = kind === "zav";
        return (
          <Card key={kind} padding={3} radius={2} border tone={isZav ? (f?.path ? "positive" : "primary") : f?.path ? "default" : "transparent"}>
            <Flex align="center" gap={3} wrap="wrap">
              <Stack gap={2} flex={1} style={{ minWidth: 200 }}>
                <Text size={1} weight="semibold">
                  {FILE_LABELS[kind].ru}
                </Text>
                <Text size={1} muted>
                  {f?.path
                    ? `${f.name ?? "файл"} · ${f.size ? Math.round(f.size / 1024) + " КБ" : ""}${
                        f.uploadedAt ? " · " + new Date(f.uploadedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : ""
                      }`
                    : isZav
                      ? "Ещё нет. Загрузите, когда придёт — клиент увидит «ZAV получен, контракт есть»."
                      : "Ещё нет"}
                </Text>
              </Stack>
              <Flex gap={2}>
                {f?.path && (
                  <Button icon={DownloadIcon} text="Скачать" mode="ghost" disabled={busy !== null} onClick={() => download(kind, f.name ?? `${kind}.pdf`)} />
                )}
                {canUpload(kind) && (
                  <Button
                    icon={UploadIcon}
                    text={isZav && !f?.path ? "Загрузить ZAV" : "Заменить"}
                    tone={isZav && !f?.path ? "primary" : "default"}
                    mode={isZav && !f?.path ? "default" : "ghost"}
                    loading={busy === kind}
                    disabled={busy !== null && busy !== kind}
                    onClick={() => pick(kind)}
                  />
                )}
              </Flex>
            </Flex>
          </Card>
        );
      })}
      {zavJustUploaded && (
        <Card padding={3} radius={2} tone="positive" border>
          <Stack gap={3}>
            <Text size={1}>
              ZAV загружен, статус — «ZAV получен — контракт есть». Заполните вкладку «ZAV и контракт» (работодатель, даты, сообщение) и нажмите Publish.
            </Text>
            {digits.length >= 10 && (
              <Flex>
                <Button
                  as="a"
                  href={`https://wa.me/${digits}?text=${encodeURIComponent(notify)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  tone="positive"
                  text="Сообщить клиенту в WhatsApp"
                />
              </Flex>
            )}
          </Stack>
        </Card>
      )}
      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      )}
    </Stack>
  );
}

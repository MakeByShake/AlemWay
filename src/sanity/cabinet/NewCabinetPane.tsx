import { useState, type FormEvent } from "react";
import { Box, Button, Card, Container, Heading, Stack, Text, TextInput } from "@sanity/ui";
import { Plus as AddIcon } from "lucide-react";
import { IntentLink } from "sanity/router";
import { useAdminFetch } from "./adminApi";
import { LinkCard } from "./LinkCard";

type Created = { id: string; link: string; phone: string };

/** Admin pane: create a cabinet after the client has paid, get the login link. */
export function NewCabinetPane() {
  const adminFetch = useAdminFetch();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Укажите имя клиента");
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/cabinet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: name.trim(), clientPhone: phone.trim() }),
      });
      const j = (await res.json()) as { id: string; link: string };
      setCreated({ ...j, phone });
      setName("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container width={1} padding={4}>
      <Stack gap={4}>
        <Heading size={2}>Новый личный кабинет</Heading>
        <Text size={1} muted>
          Создайте кабинет, когда клиент оплатил Ferienjob. Клиент войдёт по ссылке без пароля, заполнит анкету и загрузит документы.
        </Text>
        <form onSubmit={onSubmit}>
          <Stack gap={3}>
            <Stack gap={2}>
              <Text size={1} weight="semibold">
                Имя клиента
              </Text>
              <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Айгерим Нурланова" />
            </Stack>
            <Stack gap={2}>
              <Text size={1} weight="semibold">
                Телефон (для кнопки WhatsApp)
              </Text>
              <TextInput value={phone} onChange={(e) => setPhone(e.currentTarget.value)} placeholder="+7 777 123 45 67" />
            </Stack>
            <Box>
              <Button type="submit" icon={AddIcon} text="Создать кабинет и ссылку" tone="primary" loading={busy} />
            </Box>
          </Stack>
        </form>
        {error && (
          <Card padding={3} radius={2} tone="critical">
            <Text size={1}>{error}</Text>
          </Card>
        )}
        {created && (
          <Stack gap={3}>
            <LinkCard link={created.link} phone={created.phone} />
            <Text size={1}>
              <IntentLink intent="edit" params={{ id: created.id, type: "cabinet" }}>
                Открыть карточку кабинета →
              </IntentLink>
            </Text>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

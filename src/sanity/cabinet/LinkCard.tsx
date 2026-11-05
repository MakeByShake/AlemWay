import { useState } from "react";
import { Box, Button, Card, Flex, Stack, Text, TextInput } from "@sanity/ui";
import { Copy as CopyIcon } from "lucide-react";
import { copyText } from "./adminApi";

/** Shows a freshly created login link once, with a copy button and a ready WhatsApp message. */
export function LinkCard({ link, phone }: { link: string; phone?: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Здравствуйте! Ваш личный кабинет AlemWay Visa: ${link}\nЗаполните анкету и загрузите документы — декларация для деканата появится там же.`;
  const digits = (phone ?? "").replace(/\D/g, "");

  return (
    <Card padding={3} radius={2} tone="positive" border>
      <Stack gap={3}>
        <Text size={1} weight="semibold">
          Ссылка для клиента (видна только сейчас — скопируйте её)
        </Text>
        <TextInput value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
        <Flex gap={2} wrap="wrap">
          <Button
            icon={CopyIcon}
            text={copied ? "Скопировано" : "Скопировать ссылку"}
            tone="positive"
            onClick={async () => setCopied(await copyText(link))}
          />
          {digits.length >= 10 && (
            <Button
              as="a"
              href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              mode="ghost"
              text="Отправить в WhatsApp"
            />
          )}
        </Flex>
        <Box>
          <Text size={1} muted>
            Кто откроет ссылку, тот увидит кабинет. Отправляйте её только самому клиенту.
          </Text>
        </Box>
      </Stack>
    </Card>
  );
}

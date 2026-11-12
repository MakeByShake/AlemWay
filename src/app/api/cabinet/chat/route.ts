import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { currentCabinet, displayName } from "@/lib/cabinet/server";
import { CABINET_FIELDS, CABINET_STATUSES, FILE_LABELS, SERVICE_FILES, serviceOf } from "@/lib/cabinet/fields";
import { ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import { recordUsage } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TURNS = 20;
const MAX_CHARS = 1500;

// Simple per-cabinet limit (per server instance): 40 messages per hour.
const hits = new Map<string, number[]>();
function limited(id: string) {
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(id, list);
  if (hits.size > 2000) hits.clear();
  return list.length > 40;
}

/** Context about this client, so the assistant can say what exactly is missing. */
function clientContext(cab: NonNullable<Awaited<ReturnType<typeof currentCabinet>>>) {
  const service = serviceOf(cab.service);
  const status = CABINET_STATUSES.find((s) => s.value === (cab.status ?? "waiting_data"))?.title ?? cab.status;
  const filled = CABINET_FIELDS.map((f) => `- ${f.label.ru}: ${cab.data?.[f.key] ? (f.kind === "yesno" ? (cab.data[f.key] === "no" ? "Нет" : "Да") : cab.data[f.key]) : "—"}`).join("\n");
  const files = SERVICE_FILES[service].all.map((k) => `- ${FILE_LABELS[k].ru}: ${cab.files?.[k]?.path ? "загружен" : "нет"}`).join("\n");
  const ai = cab.aiCheck;
  return [
    "## Контекст клиента (данные сайта, не от клиента)",
    `Имя: ${displayName(cab)}`,
    `Этап: ${status}`,
    cab.reform
      ? "Старый клиент: декларация раньше делалась вручную, теперь переоформляем её на новый бланк 06/2026 — анкета обнулена, клиент заполняет её заново. Если спросит «почему заново» — объясни по ответу «Почему нужно делать декларацию заново?»."
      : "",
    "",
    "Анкета:",
    filled,
    "",
    "Файлы:",
    files,
    "",
    `Статус декларации (декларационный отдел): ${ai ? ai.status : "ещё не проверялась"}`,
    ai?.missing.length ? `ЧЕГО НЕ ХВАТАЕТ:\n${ai.missing.map((m) => `- ${m}`).join("\n")}` : "",
    "",
    "Клиент уже оплатил услугу, в кабинет он заходит только чтобы оформить документы. Про оплату не напоминай; если спросит — к куратору.",
    "",
    "Кнопка «Написать в WhatsApp» под чатом ведёт к куратору AlemWay. Отвечай коротко, обычным текстом без markdown-заголовков и таблиц.",
  ]
    .filter((x) => x !== undefined)
    .join("\n");
}

/** The cabinet's chat assistant. Streams plain text back. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  if (limited(cab._id)) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });

  const body = await readJsonObject(req, 64 * 1024);
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = raw
    .slice(-MAX_TURNS)
    .filter((m): m is { role: "user" | "assistant"; content: string } => {
      const x = m as { role?: unknown; content?: unknown };
      return (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim().length > 0;
    })
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: [
      { type: "text", text: ASSISTANT_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: clientContext(cab) },
    ],
    messages,
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        await recordUsage("chat", final.usage);
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("Лучше уточните это у куратора в WhatsApp."));
      } catch (err) {
        console.error("[chat] failed", err);
        controller.enqueue(encoder.encode("\n\nНе получилось ответить. Напишите, пожалуйста, куратору в WhatsApp."));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

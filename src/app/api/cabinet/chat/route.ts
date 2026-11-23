import { appPushReady, pushPublicKey } from "@/lib/push/server";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { FILE_KINDS } from "@/lib/cabinet/fields";
import { currentCabinet, type Cabinet } from "@/lib/cabinet/server";
import { openUploadKinds } from "@/lib/cabinet/upload-rules";
import { runAssistant } from "@/lib/chat/ai";
import { aiAvailable, aiFailed, clientMessages, getChat, liveUrl, postAiReply, postClientMessage, type ChatDoc } from "@/lib/chat/server";
import { CHAT_TEXT_MAX, isMessageKey } from "@/lib/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// Simple per-cabinet limits (per server instance): messages per hour, and how many of them the assistant answers.
const hits = new Map<string, number[]>();
function limited(id: string, max: number) {
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(id, list);
  if (hits.size > 4000) hits.clear();
  return list.length > max;
}

/** The chat as the client's page needs it. `after` — only messages from that moment on. */
function chatView(cab: Cabinet, chat: ChatDoc | null, after?: string | null) {
  const all = chat?.messages ?? [];
  return {
    ok: true,
    mode: chat?.mode ?? "ai",
    waiting: Boolean(chat?.waiting),
    unread: chat?.unreadClient ?? 0,
    /** Whether the assistant answers this client at all (Ferienjob only). */
    assistant: aiAvailable(cab),
    messages: clientMessages(after ? all.filter((m) => m.at >= after) : all.slice(-300)),
    /** Documents the client may upload from the chat now, and the ones already in the cabinet. */
    uploads: openUploadKinds(cab),
    have: FILE_KINDS.filter((k) => cab.files?.[k]?.path),
    live: liveUrl(cab._id),
    /** Key for turning on notifications on this device; null — notifications are off on the site. */
    push: pushPublicKey(),
    /** Notifications inside the Android app (Firebase) are set up on the site. */
    pushApp: appPushReady(),
  };
}

/** The client's chat: history, who answers now, where to listen for new messages. */
export async function GET(req: NextRequest) {
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  const after = req.nextUrl.searchParams.get("after");
  return NextResponse.json(chatView(cab, await getChat(cab._id), after && after.length < 40 ? after : null), { headers: { "Cache-Control": "no-store" } });
}

/**
 * The client sends a message. While no person has taken the chat over, the assistant answers:
 * its text is streamed back as plain text and stored. Otherwise the message waits for the team.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);

  const body = await readJsonObject(req, 64 * 1024);
  // Pages opened before the chat was stored on the server send the whole history: take its last message.
  const legacy = Array.isArray(body?.messages);
  const lastOld = legacy ? ((body!.messages as unknown[]).at(-1) as { role?: unknown; content?: unknown } | undefined) : undefined;
  const raw = legacy ? (lastOld?.role === "user" ? lastOld.content : "") : body?.text;
  const text = typeof raw === "string" ? raw.trim().slice(0, CHAT_TEXT_MAX) : "";
  if (!text) return fail("bad_request");
  if (limited(cab._id, 150)) return fail("too_many", 429);
  const key = isMessageKey(body?.key) ? body.key : undefined;

  const sent = await postClientMessage(cab, text, key);
  const plain = (s: string) => new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (sent.duplicate) return legacy ? plain("") : NextResponse.json({ ok: true, reply: "none" });
  if (!sent.ai) return legacy ? plain("Сообщение передано куратору. Обновите страницу: ответ придёт сюда, в чат.") : NextResponse.json({ ok: true, reply: "person" });
  // Too many questions to the assistant in an hour: this one goes to a person instead.
  if (limited(`ai:${cab._id}`, 40)) {
    await aiFailed(cab._id);
    return legacy ? plain("Слишком много вопросов подряд. Этот вопрос передали куратору.") : NextResponse.json({ ok: true, reply: "person" });
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The answer is stored even if the client closed the page: writing to a closed stream is ignored.
      let open = true;
      const send = (s: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          open = false;
        }
      };
      try {
        const answer = await runAssistant(cab, sent.history, send);
        if (answer.text) await postAiReply(cab._id, answer.text, answer.handoff && !answer.failed, key ? `${key}a` : undefined);
        if (answer.failed) {
          await aiFailed(cab._id);
          if (legacy) send("\n\nНе получилось ответить. Вопрос передали куратору, он ответит здесь, в чате.");
        }
      } catch (err) {
        console.error("[chat] reply failed", err);
      } finally {
        if (open) controller.close();
      }
    },
  });
  return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Chat-Reply": "assistant" } });
}

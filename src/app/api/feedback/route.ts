import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getWriteClient } from "@/sanity/client";
import { siteUrl } from "@/lib/i18n-content";
import { isSameOrigin } from "@/lib/http";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { FEEDBACK_TOPICS, type FeedbackTopic } from "@/lib/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple rate limit: max 3 feedbacks per IP per 10 minutes (per server instance).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const TOPIC_RU: Record<FeedbackTopic, string> = { site: "Сайт", service: "Наша работа", other: "Другое" };

/** Visitor feedback about the site and our work: stored privately in Sanity and sent to Telegram. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "bad_content_type" }, { status: 415 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8 * 1024) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Honeypot filled → pretend success so bots don't retry.
  if (str(body.website, 200)) return NextResponse.json({ ok: true });

  const rating = Number(body.rating);
  const topicRaw = str(body.topic, 20);
  const topic: FeedbackTopic = (FEEDBACK_TOPICS as readonly string[]).includes(topicRaw) ? (topicRaw as FeedbackTopic) : "other";
  const liked = str(body.liked, 1500);
  const improve = str(body.improve, 1500);
  const name = str(body.name, 80);
  const contact = str(body.contact, 80);
  const locale = str(body.locale, 5) === "kk" ? "kk" : "ru";
  const pageRaw = str(body.page, 300);
  const page = /^\/[\w\-/%.]*$/.test(pageRaw) ? pageRaw : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const createdAt = new Date().toISOString();
  let feedbackId: string | null = null;

  // 1) Save to Sanity. A dotted _id ("feedback.…") keeps it hidden from the public API.
  const sanity = getWriteClient();
  if (sanity) {
    try {
      const doc = await sanity.create({
        _id: `feedback.${randomUUID()}`,
        _type: "feedback",
        status: "new",
        rating,
        topic,
        liked,
        improve,
        name,
        contact,
        locale,
        page,
        createdAt,
      });
      feedbackId = doc._id;
    } catch (err) {
      console.error("[feedback] sanity save failed", err);
    }
  }

  // 2) Notify Telegram
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const mood = rating >= 4 ? "👍" : rating === 3 ? "🤔" : "⚠️";
  const sent = await sendTelegram([
    `<b>${mood} Отзыв о сайте и нашей работе</b>`,
    "",
    `<b>Оценка:</b> ${stars} (${rating}/5)`,
    `<b>О чём:</b> ${TOPIC_RU[topic]}`,
    liked && `<b>Понравилось:</b> ${escapeHtml(liked)}`,
    improve && `<b>Что улучшить:</b> ${escapeHtml(improve)}`,
    (name || contact) && `<b>От:</b> ${escapeHtml([name, contact].filter(Boolean).join(", "))}`,
    `<b>Язык:</b> ${locale.toUpperCase()}`,
    "",
    feedbackId && `📋 <a href="${siteUrl()}/admin/feedback">Открыть в админке</a>`,
  ]);

  if (!feedbackId && !sent) {
    console.error("[feedback] NOT DELIVERED — configure SANITY_API_WRITE_TOKEN or TELEGRAM_* env vars");
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

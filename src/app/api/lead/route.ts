import { NextResponse, type NextRequest } from "next/server";
import { getWriteClient } from "@/sanity/client";
import { siteUrl } from "@/lib/i18n-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- simple rate limit: max 3 leads per IP per 10 minutes (per server instance) ---
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
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Honeypot filled → pretend success so bots don't retry.
  if (str(body.website, 200)) return NextResponse.json({ ok: true });

  const name = str(body.name, 80);
  const phone = str(body.phone, 20);
  const serviceSlug = str(body.service, 100);
  const serviceTitle = str(body.serviceTitle, 200);
  const comment = str(body.comment, 1000);
  const locale = str(body.locale, 5) === "kk" ? "kk" : "ru";
  const page = str(body.page, 300);
  const utmRaw = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>;
  const utm = Object.fromEntries(
    ["source", "medium", "campaign", "term", "content"].map((k) => [k, str(utmRaw[k], 200)]).filter(([, v]) => v)
  );

  if (name.length < 2 || !/^\+7\d{10}$/.test(phone) || body.consent !== true) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const createdAt = new Date().toISOString();
  let leadId: string | null = null;
  let savedToSanity = false;
  let sentToTelegram = false;

  // 1) Save to Sanity
  const sanity = getWriteClient();
  if (sanity) {
    try {
      let serviceRef: { _type: "reference"; _ref: string; _weak: true } | undefined;
      if (serviceSlug && serviceSlug !== "other") {
        const id = await sanity.fetch<string | null>(`*[_type == "service" && slug.current == $slug][0]._id`, { slug: serviceSlug });
        if (id) serviceRef = { _type: "reference", _ref: id.replace(/^drafts\./, ""), _weak: true };
      }
      const doc = await sanity.create({
        _type: "lead",
        status: "new",
        name,
        phone,
        service: serviceRef,
        serviceTitle: serviceTitle || (serviceSlug === "other" ? "Другое / не знаю" : ""),
        comment,
        locale,
        page,
        utm,
        createdAt,
      });
      leadId = doc._id;
      savedToSanity = true;
    } catch (err) {
      console.error("[lead] sanity save failed", err);
    }
  }

  // 2) Notify Telegram
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const lines = [
      "<b>🆕 Новая заявка с сайта</b>",
      "",
      `<b>Имя:</b> ${escapeHtml(name)}`,
      `<b>Телефон:</b> ${escapeHtml(phone)}`,
      `<b>Услуга:</b> ${escapeHtml(serviceTitle || serviceSlug || "не выбрана")}`,
      comment && `<b>Комментарий:</b> ${escapeHtml(comment)}`,
      `<b>Язык:</b> ${locale.toUpperCase()}`,
      page && `<b>Страница:</b> ${escapeHtml(page)}`,
      Object.keys(utm).length ? `<b>UTM:</b> ${escapeHtml(Object.entries(utm).map(([k, v]) => `${k}=${v}`).join(", "))}` : "",
      "",
      `💬 <a href="https://wa.me/${phone.replace(/\D/g, "")}">Написать в WhatsApp</a>`,
      leadId && `📋 <a href="${siteUrl()}/studio/structure/leads;all;${leadId}">Открыть в админке</a>`,
    ].filter((x): x is string => typeof x === "string");

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
      });
      sentToTelegram = res.ok;
      if (!res.ok) console.error("[lead] telegram failed", res.status, await res.text());
    } catch (err) {
      console.error("[lead] telegram failed", err);
    }
  }

  // If the lead reached nobody, tell the visitor so they can use WhatsApp instead.
  if (!savedToSanity && !sentToTelegram) {
    console.error("[lead] NOT DELIVERED — configure SANITY_API_WRITE_TOKEN or TELEGRAM_* env vars");
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

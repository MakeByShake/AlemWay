import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getWriteClient } from "@/sanity/client";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { siteUrl } from "@/lib/i18n-content";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { CONSULTATION_PRICE, CONSULTATION_TOPICS, formatDayRu, normalizePhone, slotValid } from "@/lib/consultation";
import { bookedHours, getConsultants } from "@/lib/consultants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 3;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Booked hours of a day (no personal data) — the form hides them. `c` = consultant key or empty for «любой». */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !getWriteClient()) return NextResponse.json({ booked: [] });
  const all = await getConsultants();
  const key = req.nextUrl.searchParams.get("c") ?? "";
  const consultant = all.find((x) => x.key === key) ?? null;
  const booked = await bookedHours(date, consultant, all);
  return NextResponse.json({ booked }, { headers: { "Cache-Control": "no-store" } });
}

/** A visitor books a consultation: stored privately and sent to Telegram. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await readJsonObject(req, 4 * 1024);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  if (str(body.website, 200)) return NextResponse.json({ ok: true }); // honeypot

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });

  const name = str(body.name, 80);
  const phone = normalizePhone(str(body.phone, 30));
  const date = str(body.date, 10);
  const time = str(body.time, 5);
  const topicRaw = str(body.topic, 20);
  const topic = CONSULTATION_TOPICS.find((t) => t.value === topicRaw) ?? CONSULTATION_TOPICS[3];
  const comment = str(body.comment, 1000);
  const locale = body.locale === "kk" ? "kk" : "ru";
  if (name.length < 2 || !phone || body.consent !== true) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  if (!slotValid(date, time)) return NextResponse.json({ ok: false, error: "bad_slot" }, { status: 400 });

  const client = getWriteClient();
  if (!client) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const consultants = await getConsultants();
  const consultant = consultants.find((x) => x.key === str(body.consultant, 20)) ?? null;
  if ((await bookedHours(date, consultant, consultants)).includes(time)) {
    return NextResponse.json({ ok: false, error: "slot_taken" }, { status: 409 });
  }

  // Dot in the id keeps the document out of the public API.
  const id = `consultations.${randomUUID()}`;
  await client.create({
    _id: id,
    _type: "consultation",
    status: "new",
    name,
    phone,
    date,
    time,
    topic: topic.value,
    topicTitle: topic.ru,
    comment,
    locale,
    price: CONSULTATION_PRICE,
    paid: false,
    ...(consultant ? { manager: consultant.login, managerName: consultant.name, chosenByClient: true } : {}),
    createdAt: new Date().toISOString(),
  });

  await sendTelegram([
    "<b>📅 Новая запись на консультацию</b>",
    "",
    `<b>Когда:</b> ${escapeHtml(formatDayRu(date))}, ${time}`,
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    `<b>Тема:</b> ${escapeHtml(topic.ru)}`,
    `<b>К кому:</b> ${consultant ? escapeHtml(consultant.name) : "любой свободный — назначьте"}`,
    comment && `<b>Вопрос:</b> ${escapeHtml(comment)}`,
    `<b>Стоимость:</b> ${CONSULTATION_PRICE.toLocaleString("ru-RU")} ₸`,
    "",
    consultant ? "Подтвердите запись клиенту в WhatsApp." : "Назначьте, кто принимает, и подтвердите запись клиенту в WhatsApp.",
    `📋 <a href="${siteUrl()}/admin/consultations">Открыть консультации</a>`,
    `💬 <a href="https://wa.me/${phone.replace(/\D/g, "")}">Написать клиенту в WhatsApp</a>`,
  ]);
  return NextResponse.json({ ok: true });
}

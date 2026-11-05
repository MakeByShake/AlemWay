import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { newCabinetId, newLoginToken, writeClient } from "@/lib/cabinet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Manager creates a cabinet (optionally from a lead) and gets the client's login link once. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await readJsonObject(req, 4 * 1024);
  if (!body) return adminError("Некорректный запрос");
  const clientName = str(body.clientName, 80);
  const clientPhone = str(body.clientPhone, 30);
  const leadId = str(body.leadId, 80).replace(/^drafts\./, "");
  if (clientName.length < 2) return adminError("Укажите имя клиента");

  const client = writeClient();
  if (leadId) {
    if (!/^[\w.-]+$/.test(leadId)) return adminError("Некорректная заявка");
    const existing = await client.fetch<string | null>(`*[_type == "cabinet" && lead._ref == $lead][0]._id`, { lead: leadId });
    if (existing) {
      return adminError("Для этой заявки кабинет уже есть. Откройте его в «Личные кабинеты» и нажмите «Новая ссылка для клиента».", 409);
    }
  }

  const id = newCabinetId();
  const { hash, link } = newLoginToken();
  const digits = clientPhone.replace(/\D/g, "");
  await client.create({
    _id: id,
    _type: "cabinet",
    status: "waiting_data",
    clientName,
    clientPhone,
    tokenHash: hash,
    linkCreatedAt: new Date().toISOString(),
    ...(leadId ? { lead: { _type: "reference", _ref: leadId, _weak: true } } : {}),
    data: digits ? { phone: clientPhone } : {},
    files: {},
  });
  return NextResponse.json({ ok: true, id, link });
}

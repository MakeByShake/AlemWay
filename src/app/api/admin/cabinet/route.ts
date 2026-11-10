import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireFull } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { AdminOpError, createCabinet } from "@/lib/cabinet/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Manager creates a cabinet (optionally from a lead) and gets the client's login link once. */
export async function POST(req: NextRequest) {
  const denied = await requireFull(req);
  if (denied) return denied;

  const body = await readJsonObject(req, 4 * 1024);
  if (!body) return adminError("Некорректный запрос");
  try {
    const { id, link } = await createCabinet({
      clientName: str(body.clientName),
      clientPhone: str(body.clientPhone),
      service: body.service ? str(body.service) : undefined,
      leadId: str(body.leadId),
    });
    return NextResponse.json({ ok: true, id, link });
  } catch (err) {
    if (err instanceof AdminOpError) return adminError(err.message, err.status);
    throw err;
  }
}

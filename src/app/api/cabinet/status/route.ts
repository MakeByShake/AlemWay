import { NextResponse } from "next/server";
import { currentCabinet } from "@/lib/cabinet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where the client's cabinet is now: the page asks this when the connection dropped while the AI was working. */
export async function GET() {
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false }, { status: 401 });
  const ai = cab.aiCheck;
  return NextResponse.json({
    ok: true,
    status: cab.status ?? "waiting_data",
    ai: ai ? { status: ai.status, missing: ai.missing, clientMessage: ai.clientMessage, checkedAt: ai.checkedAt } : null,
  });
}

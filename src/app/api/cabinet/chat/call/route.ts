import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { currentCabinet } from "@/lib/cabinet/server";
import { callCurator } from "@/lib/chat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «Позвать куратора»: the chat goes to the team, the assistant stays silent until they mark it solved. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await callCurator(cab);
  return NextResponse.json({ ok: true });
}

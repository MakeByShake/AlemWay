import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { CABINET_COOKIE } from "@/lib/cabinet/server";

export const runtime = "nodejs";

/** Signs the client out on this device (the link itself keeps working). */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(CABINET_COOKIE);
  return res;
}

import { NextResponse, type NextRequest } from "next/server";
import { CABINET_COOKIE, CABINET_COOKIE_MAX_AGE, findCabinetByToken } from "@/lib/cabinet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client login link: /c/<key>. Puts the key into an httpOnly cookie and redirects to the cabinet,
 * so the key does not stay in the address bar, browser history or Referer headers.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cabinet = await findCabinetByToken(token).catch(() => null);
  const res = NextResponse.redirect(new URL(cabinet ? "/ru/cabinet" : "/ru/cabinet?invalid=1", req.url), 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  if (cabinet) {
    res.cookies.set(CABINET_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CABINET_COOKIE_MAX_AGE,
    });
  }
  return res;
}

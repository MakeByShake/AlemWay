import { NextResponse, type NextRequest } from "next/server";

/**
 * «Поделиться» target. Normally the service worker answers this request itself and keeps the files;
 * this only runs when it is not active yet, so the page explains that the file did not arrive.
 */
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/admin/share?lost=1", req.url), 303);
}

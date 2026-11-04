import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { parseBody } from "next-sanity/webhook";

export const runtime = "nodejs";

/** Sanity webhook: called after content is published, refreshes every page. */
export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "secret_not_set" }, { status: 500 });

  try {
    const { isValidSignature, body } = await parseBody<{ _type?: string }>(req, secret, true);
    if (!isValidSignature) return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    // Leads don't change public pages.
    if (body?._type === "lead") return NextResponse.json({ ok: true, skipped: true });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, revalidated: true, type: body?._type });
  } catch (err) {
    console.error("[revalidate]", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

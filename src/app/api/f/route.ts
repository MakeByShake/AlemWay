import { NextResponse, type NextRequest } from "next/server";
import { getCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";
import { SHARE_KINDS, checkShareSignature, type ShareKind } from "@/lib/cabinet/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opens one client file by a signed share link (see lib/cabinet/share.ts). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const raw = p.get("c") ?? "";
  const kind = p.get("k") ?? "";
  const sig = p.get("s") ?? "";
  const id = `cabinets.${raw}`;
  const notFound = () => NextResponse.json({ ok: false, error: "Ссылка недействительна" }, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  if (!/^[\w-]{8,64}$/.test(raw) || !SHARE_KINDS.includes(kind as ShareKind) || !checkShareSignature(id, kind, sig)) return notFound();
  const cab = await getCabinet(id);
  const file = cab?.files?.[kind as ShareKind];
  if (!file?.path) return notFound();
  const res = await fileResponse(file, { inline: true });
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

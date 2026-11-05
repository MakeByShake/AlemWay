import { NextResponse, type NextRequest } from "next/server";
import { FILE_KINDS, type FileKind } from "@/lib/cabinet/fields";
import { currentCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the cabinet owner download their own files (e.g. the declaration to print). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!FILE_KINDS.includes(kind as FileKind)) return NextResponse.json({ ok: false }, { status: 404 });
  const cab = await currentCabinet();
  if (!cab) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return fileResponse(cab.files?.[kind as FileKind]);
}

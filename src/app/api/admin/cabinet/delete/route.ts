import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireOwner } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { AdminOpError, deleteCabinetCompletely } from "@/lib/cabinet/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager deletes a client completely (files + cabinet document), see deleteCabinetCompletely. */
export async function POST(req: NextRequest) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const body = await readJsonObject(req, 1024);
  try {
    const res = await deleteCabinetCompletely(typeof body?.id === "string" ? body.id : "");
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    if (err instanceof AdminOpError) return adminError(err.message, err.status);
    throw err;
  }
}

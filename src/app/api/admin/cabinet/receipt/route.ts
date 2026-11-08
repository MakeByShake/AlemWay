import { type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { getCabinet } from "@/lib/cabinet/server";
import { fileResponse } from "@/lib/cabinet/file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manager downloads a payment receipt. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const cab = id.startsWith("cabinets.") ? await getCabinet(id) : null;
  if (!cab) return adminError("Клиент не найден", 404);
  return fileResponse(cab.payments?.find((p) => p._key === key)?.receipt);
}

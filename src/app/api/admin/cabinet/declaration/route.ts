import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireFull } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { getCabinet } from "@/lib/cabinet/server";
import { serviceOf } from "@/lib/cabinet/fields";
import { checkAndBuildDeclaration } from "@/lib/cabinet/ai-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manager re-runs the AI check (and rebuilds the declaration if the documents are fine). */
export async function POST(req: NextRequest) {
  const denied = await requireFull(req);
  if (denied) return denied;
  const body = await readJsonObject(req, 1024);
  const id = typeof body?.id === "string" ? body.id.replace(/^drafts\./, "") : "";
  if (!id.startsWith("cabinets.")) return adminError("Некорректный кабинет");
  const cab = await getCabinet(id);
  if (!cab) return adminError("Кабинет не найден", 404);
  if (serviceOf(cab.service) !== "ferienjob") return adminError("Декларация ZAV есть только у кабинетов Ferienjob");
  const ai = await checkAndBuildDeclaration(id, "manager");
  return NextResponse.json({ ok: true, status: ai.status, missing: ai.missing });
}

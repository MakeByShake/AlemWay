import { NextResponse, type NextRequest } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/http";
import { getCabinet, writeClient } from "@/lib/cabinet/server";
import { deleteFile } from "@/lib/cabinet/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manager deletes a client completely: every stored file (passport, declaration, ZAV…) and the cabinet
 * document with its draft. Deleting only the document in Studio would leave the files in Blob storage.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await readJsonObject(req, 1024);
  const id = typeof body?.id === "string" ? body.id.replace(/^drafts\./, "") : "";
  if (!id.startsWith("cabinets.")) return adminError("Некорректный кабинет");

  const client = writeClient();
  const [published, draft] = await Promise.all([getCabinet(id), getCabinet(id, true)]);
  if (!published && !draft) return adminError("Кабинет не найден", 404);

  // Files from both versions (the draft may point to a newer upload).
  const paths = new Set<string>();
  for (const cab of [published, draft]) {
    for (const f of Object.values(cab?.files ?? {})) if (f?.path) paths.add(f.path);
  }
  const failed: string[] = [];
  for (const p of paths) {
    try {
      await deleteFile(p);
    } catch (err) {
      console.error("[cabinet delete] file", p, err);
      failed.push(p);
    }
  }

  await client.transaction().delete(id).delete(`drafts.${id}`).commit();
  return NextResponse.json({ ok: true, deletedFiles: paths.size - failed.length, failedFiles: failed.length });
}

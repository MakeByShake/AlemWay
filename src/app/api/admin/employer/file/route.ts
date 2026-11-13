import { type NextRequest } from "next/server";
import { adminAccess, adminError } from "@/lib/admin-auth";
import { getEmployer } from "@/lib/admin/employers";
import { fileResponse } from "@/lib/cabinet/file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads (or with view=1 opens) an employer's document. Any logged-in team member. */
export async function GET(req: NextRequest) {
  const access = await adminAccess(req);
  if (!access) return adminError("Нет доступа. Войдите в админку заново.", 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!/^employers\.[\w-]+$/.test(id)) return adminError("Некорректный запрос");
  const emp = await getEmployer(id);
  return fileResponse(emp?.files?.find((f) => f._key === key), { inline: req.nextUrl.searchParams.get("view") === "1" });
}

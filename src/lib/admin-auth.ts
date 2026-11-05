import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { projectId } from "@/sanity/env";

/**
 * Checks that the request comes from a logged-in member of our Sanity project.
 * The Studio sends the manager's own login token; we ask Sanity who it belongs to and whether
 * that user is a member of this project. No shared admin password exists anywhere.
 */
const cache = new Map<string, { ok: boolean; until: number }>();

export async function isProjectMember(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 500 || !projectId) return false;

  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.ok;

  let ok = false;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [meRes, projRes] = await Promise.all([
      fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, { headers, cache: "no-store" }),
      fetch(`https://api.sanity.io/v2021-06-07/projects/${projectId}`, { headers, cache: "no-store" }),
    ]);
    if (meRes.ok && projRes.ok) {
      const me = (await meRes.json()) as { id?: string };
      const project = (await projRes.json()) as { members?: { id: string; isRobot?: boolean }[] };
      ok = Boolean(me.id && project.members?.some((m) => m.id === me.id && !m.isRobot));
    }
  } catch (err) {
    console.error("[admin-auth] check failed", err);
  }
  cache.set(key, { ok, until: Date.now() + (ok ? 5 * 60_000 : 30_000) });
  if (cache.size > 500) cache.clear();
  return ok;
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isProjectMember(req)) return null;
  return NextResponse.json({ ok: false, message: "Нет доступа. Войдите в админку заново." }, { status: 401 });
}

export const adminError = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

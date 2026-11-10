import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { projectId } from "@/sanity/env";
import { isSameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin/session";

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

export type AdminAccess = { owner: boolean; login: string | null };

/**
 * Who is calling an admin API: an /admin user (by cookie; writes must come from our pages — CSRF)
 * or a member of the Sanity project (Studio, counts as owner). Null = not logged in.
 */
export async function adminAccess(req: NextRequest): Promise<AdminAccess | null> {
  if (req.method === "GET" || isSameOrigin(req)) {
    try {
      const user = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
      if (user) return { owner: user.role === "owner", login: user.login };
    } catch (err) {
      console.error("[admin-auth] session check failed", err);
    }
  }
  if (await isProjectMember(req)) return { owner: true, login: null };
  return null;
}

/** Owners see every client; a manager only the clients the owner assigned to him. */
export const canSeeCabinet = (a: AdminAccess, cab: { manager?: string | null }) => a.owner || (!!a.login && cab.manager === a.login);

const NO_LOGIN = () => NextResponse.json({ ok: false, message: "Нет доступа. Войдите в админку заново." }, { status: 401 });
const NO_RIGHTS = () => NextResponse.json({ ok: false, message: "Это может делать только владелец." }, { status: 403 });

/** Any logged-in admin. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  return (await adminAccess(req)) ? null : NO_LOGIN();
}

/** Owners (and Studio members) only. */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  const a = await adminAccess(req);
  if (!a) return NO_LOGIN();
  return a.owner ? null : NO_RIGHTS();
}

export const adminError = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

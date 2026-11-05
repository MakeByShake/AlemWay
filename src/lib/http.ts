import "server-only";
import type { NextRequest } from "next/server";

/** True when the request was sent by a page of this site (blocks cross-site requests / CSRF). */
export function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** Reads a small JSON object body. Returns null if it is too large, not JSON or not an object. */
export async function readJsonObject(req: NextRequest, maxBytes: number): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const raw = await req.text();
    if (raw.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

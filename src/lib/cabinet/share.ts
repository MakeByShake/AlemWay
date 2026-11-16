import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Share links for a client's files (for the team's Google Sheet): anyone with the link opens that one file,
 * without logging in. The link carries a signature of «cabinet + file kind», so it can't be guessed or changed
 * to another client. It always opens the current file of that kind (a replaced file is the new one).
 */

export const SHARE_KINDS = ["passport", "enrollment", "declaration", "signed", "signed2", "license", "zav", "contract", "calendar"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

function key() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET is not set");
  return createHmac("sha256", s).update("file-share-v1").digest();
}

export const shareSignature = (id: string, kind: string) => createHmac("sha256", key()).update(`${id}:${kind}`).digest("base64url").slice(0, 32);

export function checkShareSignature(id: string, kind: string, sig: string) {
  const want = Buffer.from(shareSignature(id, kind));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const shareUrl = (base: string, id: string, kind: ShareKind) =>
  `${base}/api/f?c=${encodeURIComponent(id.replace(/^cabinets\./, ""))}&k=${kind}&s=${shareSignature(id, kind)}`;

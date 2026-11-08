import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { SanityClient } from "next-sanity";
import { getWriteClient } from "@/sanity/client";
import { siteUrl } from "@/lib/i18n-content";
import type { CabinetData, CabinetStatus, FileKind, ServiceId } from "./fields";

export const CABINET_COOKIE = "aw_cabinet";
export const CABINET_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export type StoredFile = { path: string; name: string; contentType: string; size: number; uploadedAt: string };

export type Cabinet = {
  _id: string;
  _rev?: string;
  status?: CabinetStatus;
  clientName?: string;
  clientPhone?: string;
  data?: CabinetData;
  files?: Partial<Record<FileKind, StoredFile>>;
  declarationDate?: string;
  submittedAt?: string;
  signedAt?: string;
  service?: ServiceId;
  ketaValidUntil?: string;
  zavReceivedAt?: string;
  employerName?: string;
  workCity?: string;
  workPosition?: string;
  workFrom?: string;
  workTo?: string;
  clientMessage?: string;
};

const PROJECTION = `{_id, _rev, service, status, clientName, clientPhone, data, files, declarationDate, submittedAt, signedAt,
  zavReceivedAt, employerName, workCity, workPosition, workFrom, workTo, clientMessage, ketaValidUntil}`;

export function writeClient(): SanityClient {
  const c = getWriteClient();
  if (!c) throw new Error("Sanity write client is not configured");
  return c;
}

/** Login key for the client link: 32 random bytes, only its SHA-256 hash is stored. */
export function newLoginToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), link: `${siteUrl()}/c/${token}` };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const isTokenShape = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export function newCabinetId() {
  // The dot keeps the document out of the public API of the (public) dataset.
  return `cabinets.${randomUUID()}`;
}

export async function findCabinetByToken(token: string): Promise<Cabinet | null> {
  if (!isTokenShape(token)) return null;
  return writeClient().fetch<Cabinet | null>(`*[_type == "cabinet" && tokenHash == $h && !(_id in path("drafts.**"))][0]${PROJECTION}`, {
    h: hashToken(token),
  });
}

/** The cabinet of the current visitor (from the httpOnly cookie), or null. */
export async function currentCabinet(): Promise<Cabinet | null> {
  const token = (await cookies()).get(CABINET_COOKIE)?.value;
  if (!token) return null;
  return findCabinetByToken(token);
}

/** Published cabinet by id, or its draft if the manager has unpublished edits (used for the declaration). */
export async function getCabinet(id: string, preferDraft = false): Promise<Cabinet | null> {
  const c = writeClient();
  if (preferDraft) {
    const draft = await c.fetch<Cabinet | null>(`*[_id == $id][0]${PROJECTION}`, { id: `drafts.${id}` });
    if (draft) return { ...draft, _id: id };
  }
  return c.fetch<Cabinet | null>(`*[_id == $id && _type == "cabinet"][0]${PROJECTION}`, { id });
}

/**
 * Sets fields on the published cabinet and on the manager's draft, if one is open.
 * Otherwise publishing an older draft in the Studio would wipe what the client just sent.
 */
export async function patchCabinet(id: string, set: Record<string, unknown>, unset: string[] = []) {
  const c = writeClient();
  const draftId = `drafts.${id}`;
  const hasDraft = Boolean(await c.fetch(`defined(*[_id == $id][0]._id)`, { id: draftId }));
  const apply = (p: ReturnType<SanityClient["patch"]>) => {
    const q = p.setIfMissing({ data: {}, files: {} }).set(set);
    return unset.length ? q.unset(unset) : q;
  };
  const tx = c.transaction().patch(apply(c.patch(id)));
  if (hasDraft) tx.patch(apply(c.patch(draftId)));
  await tx.commit({ visibility: "sync" });
}

export const cabinetAdminUrl = (id: string) => `${siteUrl()}/admin/clients/${id}`;

export function displayName(cab: Cabinet) {
  const n = [cab.data?.firstName, cab.data?.lastName].filter(Boolean).join(" ");
  return n || cab.clientName || "Без имени";
}

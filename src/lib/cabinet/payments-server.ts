import "server-only";
import { randomUUID } from "node:crypto";
import type { SanityClient } from "next-sanity";
import { writeClient, type Cabinet } from "./server";
import { deleteFile, saveFile } from "./storage";
import type { Payment, Receipt } from "./payments";

/** Payment writes on a cabinet (and its Studio draft, if one is open). */

async function targets(c: SanityClient, id: string) {
  const hasDraft = Boolean(await c.fetch(`defined(*[_id == $id][0]._id)`, { id: `drafts.${id}` }));
  return hasDraft ? [id, `drafts.${id}`] : [id];
}

export async function addPayment(id: string, p: Omit<Payment, "_key" | "createdAt">) {
  const c = writeClient();
  const payment: Payment = { ...p, _key: randomUUID().replace(/-/g, "").slice(0, 16), createdAt: new Date().toISOString() };
  const tx = c.transaction();
  for (const t of await targets(c, id)) tx.patch(t, (q) => q.setIfMissing({ payments: [] }).append("payments", [payment]));
  await tx.commit({ visibility: "sync" });
  return payment;
}

const KEY_RE = /^[a-z0-9]{6,32}$/;

export async function setPaymentStatus(id: string, key: string, status: Payment["status"]) {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  const c = writeClient();
  const tx = c.transaction();
  for (const t of await targets(c, id)) tx.patch(t, (q) => q.set({ [`payments[_key=="${key}"].status`]: status }));
  await tx.commit({ visibility: "sync" });
}

export async function removePayment(cab: Cabinet, key: string) {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  const c = writeClient();
  const tx = c.transaction();
  for (const t of await targets(c, cab._id)) tx.patch(t, (q) => q.unset([`payments[_key=="${key}"]`]));
  await tx.commit({ visibility: "sync" });
  await deleteFile(cab.payments?.find((p) => p._key === key)?.receipt?.path);
}

export async function saveReceipt(cabId: string, up: { buf: Buffer; type: string; ext: string }): Promise<Receipt> {
  const path = await saveFile(`${cabId}/receipt.${up.ext}`, up.buf, up.type);
  return { path, name: `receipt.${up.ext}`, contentType: up.type, size: up.buf.length, uploadedAt: new Date().toISOString() };
}

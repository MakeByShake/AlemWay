import "server-only";
import { randomUUID } from "node:crypto";
import type { SanityClient } from "next-sanity";
import { writeClient, type Cabinet } from "./server";
import { deleteFile, saveFile } from "./storage";
import { receiptsOf, type Payment, type Receipt } from "./payments";

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
  const p = cab.payments?.find((x) => x._key === key);
  if (p) await Promise.all(receiptsOf(p).map((r) => deleteFile(r.path).catch(() => null)));
}

/** Sets fields of one payment (amount, date, method, note, payer, kind). */
export async function updatePayment(id: string, key: string, set: Record<string, unknown>, unset: string[] = []) {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  const c = writeClient();
  const at = (k: string) => `payments[_key=="${key}"].${k}`;
  const tx = c.transaction();
  for (const t of await targets(c, id))
    tx.patch(t, (q) => {
      const p = q.set(Object.fromEntries(Object.entries(set).map(([k, v]) => [at(k), v])));
      return unset.length ? p.unset(unset.map(at)) : p;
    });
  await tx.commit({ visibility: "sync" });
}

/** Adds one more receipt to a payment. */
export async function addReceipt(id: string, key: string, receipt: Receipt) {
  if (!KEY_RE.test(key)) throw new Error("bad key");
  const c = writeClient();
  const r = { ...receipt, _key: randomUUID().replace(/-/g, "").slice(0, 12) };
  const tx = c.transaction();
  for (const t of await targets(c, id))
    tx.patch(t, (q) => q.setIfMissing({ [`payments[_key=="${key}"].receipts`]: [] }).append(`payments[_key=="${key}"].receipts`, [r]));
  await tx.commit({ visibility: "sync" });
  return r;
}

/** Removes one receipt of a payment (the old single one has the key «main»). */
export async function removeReceipt(cab: Cabinet, key: string, rKey: string) {
  if (!KEY_RE.test(key) || !/^[a-z0-9]{4,32}$/.test(rKey)) throw new Error("bad key");
  const p = cab.payments?.find((x) => x._key === key);
  const r = p && receiptsOf(p).find((x) => x._key === rKey);
  if (!r) return;
  const c = writeClient();
  const path = rKey === "main" ? `payments[_key=="${key}"].receipt` : `payments[_key=="${key}"].receipts[_key=="${rKey}"]`;
  const tx = c.transaction();
  for (const t of await targets(c, cab._id)) tx.patch(t, (q) => q.unset([path]));
  await tx.commit({ visibility: "sync" });
  await deleteFile(r.path).catch(() => null);
}

export async function saveReceipt(cabId: string, up: { buf: Buffer; type: string; ext: string }): Promise<Receipt> {
  const path = await saveFile(`${cabId}/receipt.${up.ext}`, up.buf, up.type);
  return { path, name: `receipt.${up.ext}`, contentType: up.type, size: up.buf.length, uploadedAt: new Date().toISOString() };
}

import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import webpush from "web-push";
import { writeClient } from "@/lib/cabinet/server";

/**
 * Push notifications for clients (Web Push): the installed site on an iPhone, Chrome on Android or a computer.
 * One private document per client keeps their devices: `pushsubs.<uuid of the cabinet>`.
 * Turned on by VAPID keys in the environment; without them nothing is offered or sent.
 */

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Stored = PushSub & { _key: string; at: string };

const pub = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const priv = () => process.env.VAPID_PRIVATE_KEY ?? "";
export const pushPublicKey = () => (pub() && priv() ? pub() : null);

const docId = (cabinetId: string) => `pushsubs.${cabinetId.replace(/^cabinets\./, "")}`;
const keyOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 16);

export function isPushSub(v: unknown): v is PushSub {
  const s = v as PushSub;
  return Boolean(s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string" && s.keys.p256dh.length < 200 && s.keys.auth.length < 100);
}

/** Remembers a device of the client (at most 5, the newest win). */
export async function savePushSub(cabinetId: string, sub: PushSub) {
  const c = writeClient();
  const id = docId(cabinetId);
  const old = (await c.fetch<Stored[] | null>(`*[_id == $id][0].subs`, { id })) ?? [];
  const key = keyOf(sub.endpoint);
  const subs: Stored[] = [{ _key: key, at: new Date().toISOString(), endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, ...old.filter((s) => s._key !== key)].slice(0, 5);
  await c.createOrReplace({ _id: id, _type: "pushSubs", cabinet: cabinetId, subs });
}

export async function removePushSub(cabinetId: string, endpoint: string) {
  await writeClient()
    .patch(docId(cabinetId))
    .unset([`subs[_key == "${keyOf(endpoint)}"]`])
    .commit()
    .catch(() => null);
}

export async function deletePushSubsOf(cabinetId: string) {
  await writeClient().delete(docId(cabinetId)).catch(() => null);
}

async function send(cabinetIds: string[], payload: { title?: string; body: string; url?: string }) {
  if (!pushPublicKey()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alemway.kz@gmail.com", pub(), priv());
  const docs = await writeClient().fetch<{ cabinet: string; subs?: Stored[] }[]>(`*[_type == "pushSubs" && cabinet in $ids]{cabinet, subs}`, { ids: cabinetIds });
  const body = JSON.stringify({ title: payload.title ?? "AlemWay", body: payload.body.length > 180 ? `${payload.body.slice(0, 179)}…` : payload.body, url: payload.url ?? "/ru/cabinet/chat" });
  await Promise.all(
    docs.flatMap((d) =>
      (d.subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 24 * 3600, urgency: "normal" });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // The device unsubscribed or the browser forgot it: drop it.
          if (code === 404 || code === 410) await removePushSub(d.cabinet, s.endpoint);
          else console.error("[push] send failed", code, err);
        }
      })
    )
  );
}

/** Tells the clients' phones about a new message in their chat. Runs after the answer has gone out; never throws. */
export function notifyClients(cabinetIds: string[], payload: { title?: string; body: string; url?: string }) {
  if (!pushPublicKey() || !cabinetIds.length) return;
  const job = () => send(cabinetIds, payload).catch((err) => console.error("[push]", err));
  try {
    after(job);
  } catch {
    void job();
  }
}

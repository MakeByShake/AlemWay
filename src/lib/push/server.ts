import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import webpush from "web-push";
import { writeClient } from "@/lib/cabinet/server";
import { fcmReady, fcmSend } from "./fcm";

/**
 * Push notifications for clients (Web Push): the installed site on an iPhone, Chrome on Android or a computer.
 * One private document per client keeps their devices: `pushsubs.<uuid of the cabinet>`.
 * Turned on by VAPID keys in the environment; without them nothing is offered or sent.
 * The Android app gets its notifications through Firebase instead: then a device is just its token (`fcm`).
 */

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type AppSub = { fcm: string };
type Stored = { _key: string; at: string } & (PushSub | (AppSub & { endpoint?: undefined }));

const pub = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const priv = () => process.env.VAPID_PRIVATE_KEY ?? "";
export const pushPublicKey = () => (pub() && priv() ? pub() : null);
export const appPushReady = fcmReady;
const anyPush = () => Boolean(pushPublicKey() || fcmReady());

const docId = (cabinetId: string) => `pushsubs.${cabinetId.replace(/^cabinets\./, "")}`;
const keyOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 16);

export function isPushSub(v: unknown): v is PushSub {
  const s = v as PushSub;
  return Boolean(s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string" && s.keys.p256dh.length < 200 && s.keys.auth.length < 100);
}

export function isAppSub(v: unknown): v is AppSub {
  const s = v as AppSub;
  return Boolean(s && typeof s.fcm === "string" && /^[\w:.-]{20,4096}$/.test(s.fcm));
}

const idOf = (s: PushSub | AppSub) => ("fcm" in s ? `fcm:${s.fcm}` : s.endpoint);

/** Remembers a device of the client (at most 5, the newest win). */
export async function savePushSub(cabinetId: string, sub: PushSub | AppSub) {
  const c = writeClient();
  const id = docId(cabinetId);
  const old = (await c.fetch<Stored[] | null>(`*[_id == $id][0].subs`, { id })) ?? [];
  const key = keyOf(idOf(sub));
  const at = new Date().toISOString();
  const entry: Stored = "fcm" in sub ? { _key: key, at, fcm: sub.fcm } : { _key: key, at, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  const subs: Stored[] = [entry, ...old.filter((s) => s._key !== key)].slice(0, 5);
  await c.createOrReplace({ _id: id, _type: "pushSubs", cabinet: cabinetId, subs });
}

/** `device`: the browser's endpoint, or `fcm:<token>` for the Android app. */
export async function removePushSub(cabinetId: string, device: string) {
  await writeClient()
    .patch(docId(cabinetId))
    .unset([`subs[_key == "${keyOf(device)}"]`])
    .commit()
    .catch(() => null);
}

export async function deletePushSubsOf(cabinetId: string) {
  await writeClient().delete(docId(cabinetId)).catch(() => null);
}

async function send(cabinetIds: string[], payload: { title?: string; body: string; url?: string }) {
  if (!anyPush()) return;
  const web = Boolean(pushPublicKey());
  if (web) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:alemway.kz@gmail.com", pub(), priv());
  const docs = await writeClient().fetch<{ cabinet: string; subs?: Stored[] }[]>(`*[_type == "pushSubs" && cabinet in $ids]{cabinet, subs}`, { ids: cabinetIds });
  const msg = { title: payload.title ?? "AlemWay", body: payload.body.length > 180 ? `${payload.body.slice(0, 179)}…` : payload.body, url: payload.url ?? "/ru/cabinet/chat" };
  const body = JSON.stringify(msg);
  await Promise.all(
    docs.flatMap((d) =>
      (d.subs ?? []).map(async (s) => {
        if ("fcm" in s && s.fcm) {
          if (!fcmReady()) return;
          // The phone removed the app or Firebase forgot it: drop it.
          const result = await fcmSend(s.fcm, msg).catch((err: unknown) => `error ${String(err).slice(0, 120)}`);
          if (result === "gone") await removePushSub(d.cabinet, `fcm:${s.fcm}`);
          await noteLastSend(d.cabinet, result);
          return;
        }
        if (!web || !s.endpoint || !("keys" in s)) return;
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

/** The last delivery into the app, so the team sees in the client's profile whether notifications reach them. */
async function noteLastSend(cabinetId: string, result: string) {
  await writeClient()
    .patch(docId(cabinetId))
    .set({ last: { at: new Date().toISOString(), result: result.slice(0, 200) } })
    .commit()
    .catch(() => null);
}

/** For the client's profile in the admin: where notifications are on and how the last one went. */
export async function pushStatusOf(cabinetId: string): Promise<string> {
  if (!anyPush()) return "";
  const doc = await writeClient()
    .fetch<{ subs?: Stored[]; last?: { at: string; result: string } } | null>(`*[_id == $id][0]{subs, last}`, { id: docId(cabinetId) })
    .catch(() => null);
  const app = (doc?.subs ?? []).filter((s) => "fcm" in s && s.fcm).length;
  const web = (doc?.subs ?? []).length - app;
  if (!app && !web) return "выключены";
  const where = [app ? "в приложении" : "", web ? "в браузере" : ""].filter(Boolean).join(" и ");
  const last = doc?.last ? (doc.last.result === "ok" ? ", последнее доставлено" : doc.last.result === "gone" ? ", приложение удалено" : `, ошибка: ${doc.last.result.replace(/^error /, "")}`) : "";
  return `включены ${where}${last}`;
}

/** Tells the clients' phones about a new message in their chat. Runs after the answer has gone out; never throws. */
export function notifyClients(cabinetIds: string[], payload: { title?: string; body: string; url?: string }) {
  if (!anyPush() || !cabinetIds.length) return;
  const job = () => send(cabinetIds, payload).catch((err) => console.error("[push]", err));
  try {
    after(job);
  } catch {
    void job();
  }
}

import "server-only";
import { createSign } from "node:crypto";

/**
 * Notifications into the Android app (Firebase Cloud Messaging, HTTP v1).
 * Turned on by FIREBASE_SERVICE_ACCOUNT: the JSON key of a Firebase service account (kept only in Vercel).
 */

type Account = { project_id: string; client_email: string; private_key: string };

function account(): Account | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const a = JSON.parse(raw.trim()) as Account;
    if (!a.project_id || !a.client_email || !a.private_key) return null;
    // A key pasted through a terminal can keep its line breaks as the two characters "\n".
    return { ...a, private_key: a.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export const fcmReady = () => account() !== null;

// The test stand points both Google hosts at its mock (never set in Vercel).
const OAUTH = process.env.FCM_TEST_BASE ? `${process.env.FCM_TEST_BASE}/token` : "https://oauth2.googleapis.com/token";
const FCM = process.env.FCM_TEST_BASE ?? "https://fcm.googleapis.com";

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");
let cached: { token: string; until: number } | null = null;

/** A short-lived Google access token from the service account (signed JWT, cached for ~50 minutes). */
async function accessToken(a: Account): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(a.private_key).toString("base64url");
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${signature}` }),
  });
  if (!res.ok) throw new Error(`fcm auth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { token: data.access_token, until: Date.now() + Math.min(data.expires_in ?? 3600, 3000) * 1000 };
  return data.access_token;
}

/** Sends one notification. Returns "gone" when the phone no longer has the app (the token should be dropped). */
export async function fcmSend(token: string, msg: { title: string; body: string; url: string }): Promise<"ok" | "gone" | `error ${string}`> {
  const a = account();
  if (!a) return "error no key";
  const res = await fetch(`${FCM}/v1/projects/${a.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(a)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: { url: msg.url },
        android: { priority: "high", ttl: "86400s", notification: { channel_id: "messages" } },
      },
    }),
  });
  if (res.ok) return "ok";
  if (res.status === 404 || res.status === 400) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(text)) return "gone";
  }
  const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
  console.error("[push] fcm failed", res.status, why);
  return `error ${res.status} ${why}`;
}

import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, readJsonObject } from "@/lib/http";
import { currentCabinet } from "@/lib/cabinet/server";
import { appPushReady, isAppSub, isPushSub, pushPublicKey, removePushSub, savePushSub } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** The client turns notifications on for this device (body: the browser's push subscription, or `{fcm}` from the Android app). */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  const body = await readJsonObject(req, 8192);
  if (isAppSub(body)) {
    if (!appPushReady()) return fail("off", 404);
    await savePushSub(cab._id, { fcm: body.fcm });
    return NextResponse.json({ ok: true });
  }
  if (!pushPublicKey()) return fail("off", 404);
  if (!isPushSub(body)) return fail("bad_request", 400);
  await savePushSub(cab._id, body);
  return NextResponse.json({ ok: true });
}

/** Notifications off for this device. */
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("forbidden", 403);
  const cab = await currentCabinet();
  if (!cab) return fail("unauthorized", 401);
  const body = await readJsonObject(req, 4096);
  if (typeof body?.endpoint === "string") await removePushSub(cab._id, body.endpoint);
  else if (isAppSub(body)) await removePushSub(cab._id, `fcm:${body.fcm}`);
  return NextResponse.json({ ok: true });
}

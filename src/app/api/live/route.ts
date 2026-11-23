import type { NextRequest } from "next/server";
import { apiVersion, dataset, isSanityConfigured, projectId } from "@/sanity/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How long one connection lives; the browser reconnects by itself and catches up (see useLive). */
const LIFETIME_MS = 240_000;

/**
 * Live updates of the chat, through our own site: the server listens to one «signal» document in Sanity
 * and passes its events (welcome, mutation) to the browser as they are. Same address as the site, so no
 * cross-site rules or ad blockers stand in the way, and it works the same in the app.
 * The id only names a counter (chatsig-<HMAC>), it reveals nothing.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!/^chatsig-[0-9a-f]{32}$/.test(id) || !isSanityConfigured || !token) return new Response("not found", { status: 404 });

  // SANITY_API_HOST: local tests only (see src/sanity/client.ts).
  const host = process.env.SANITY_API_HOST || `https://${projectId}.api.sanity.io`;
  const q = new URLSearchParams({ query: "*[_id == $id]", $id: JSON.stringify(id), includeResult: "false", visibility: "query" });
  const upstream = new AbortController();
  const stop = () => upstream.abort();
  req.signal.addEventListener("abort", stop);
  const timer = setTimeout(stop, LIFETIME_MS);

  const res = await fetch(`${host}/v${apiVersion}/data/listen/${dataset}?${q}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal: upstream.signal,
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok || !res.body) {
    clearTimeout(timer);
    return new Response("unavailable", { status: 503 });
  }

  const reader = res.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Reconnect quickly after the planned end of a connection.
      controller.enqueue(new TextEncoder().encode("retry: 1000\n\n"));
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          clearTimeout(timer);
          controller.close();
        } else controller.enqueue(value);
      } catch {
        clearTimeout(timer);
        controller.close();
      }
    },
    cancel() {
      clearTimeout(timer);
      stop();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" },
  });
}

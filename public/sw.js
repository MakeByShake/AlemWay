// AlemWay service worker: makes the site installable, shows a page when there is no internet,
// and shows push notifications for clients (news from their chat).
const OFFLINE = "/offline.html";
const CACHE = "aw-v2";
const KEEP = [CACHE, "aw-share", "aw-docs"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([new Request(OFFLINE, { cache: "reload" }), "/brand/alemway_icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// «Поделиться» → AlemWay (Android): the shared files wait in a cache until a team member picks the client.
const SHARE = "aw-share";
async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE);
  for (const key of await cache.keys()) await cache.delete(key);
  let n = 0;
  for (const f of form.getAll("file")) {
    if (!(f instanceof File) || n >= 10) continue;
    await cache.put(`/share-inbox/${n++}`, new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Name": encodeURIComponent(f.name || "file") } }));
  }
  const text = [form.get("title"), form.get("text"), form.get("url")].filter((v) => typeof v === "string" && v.trim()).join("\n");
  if (text) await cache.put("/share-inbox/text", new Response(text));
  return Response.redirect("/admin/share", 303);
}

// The client's trip documents for use without internet (sent by the cabinet page in the installed app only).
const DOCS = "aw-docs";
// Bumped on logout: a save that started before it does not bring the documents back.
let generation = 0;
self.addEventListener("message", (e) => {
  const msg = e.data || {};
  if (e.origin !== self.location.origin) return;
  if (msg.type === "aw-offline-clear") {
    generation++;
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(DOCS)).map((k) => caches.delete(k)))));
    return;
  }
  if (msg.type !== "aw-offline-save" || !msg.snapshot) return;
  const gen = generation;
  e.waitUntil(
    (async () => {
      const snap = msg.snapshot;
      const urls = (snap.docs || []).map((d) => d.url).filter((u) => typeof u === "string" && u.startsWith("/api/cabinet/file/"));
      const tmp = `${DOCS}-new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fresh = await caches.open(tmp);
      const kept = [];
      for (const u of urls) {
        const res = await fetch(u, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
        if (res && res.ok) {
          await fresh.put(u, res);
          kept.push(u);
        }
      }
      snap.docs = (snap.docs || []).filter((d) => kept.includes(d.url));
      await fresh.put("/offline/cabinet.json", new Response(JSON.stringify(snap), { headers: { "Content-Type": "application/json" } }));
      // Copy over only when everything is downloaded, so a half-finished save never spoils a good one;
      // then drop documents that are no longer there.
      if (gen !== generation) return caches.delete(tmp);
      const docs = await caches.open(DOCS);
      const keep = new Set();
      for (const req of await fresh.keys()) {
        await docs.put(req, await fresh.match(req));
        keep.add(new URL(req.url).pathname);
      }
      for (const req of await docs.keys()) if (!keep.has(new URL(req.url).pathname)) await docs.delete(req);
      await caches.delete(tmp);
    })().catch(() => {})
  );
});

// Pages always come from the network (client data is never cached); without internet, a short notice.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/api/cabinet/file/")) {
    e.respondWith(fetch(e.request).catch(async () => (await caches.open(DOCS).then((c) => c.match(url.pathname + url.search, { ignoreVary: true }))) || Response.error()));
    return;
  }
  if (e.request.method === "POST" && url.origin === self.location.origin && url.pathname === "/admin/share/receive") {
    e.respondWith(receiveShare(e.request).catch(() => Response.redirect("/admin/share?lost=1", 303)));
    return;
  }
  if (url.origin === self.location.origin && url.pathname === "/brand/alemway_icon.svg") {
    e.respondWith(fetch(e.request).catch(async () => (await caches.match(url.pathname, { ignoreVary: true })) || Response.error()));
    return;
  }
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE, { ignoreVary: true })));
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "AlemWay", {
      body: data.body || "Новое сообщение в чате",
      icon: "/brand/alemway_icon.png",
      badge: "/brand/alemway_icon.png",
      tag: data.tag || "aw-chat",
      renotify: true,
      data: { url: data.url || "/ru/cabinet/chat" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/ru/cabinet/chat", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.location.origin) && "focus" in c) return c.navigate(url).then((w) => (w || c).focus());
      return self.clients.openWindow(url);
    })
  );
});

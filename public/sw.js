// Gassi's service worker, hand-written. Build assets and icons: cache first (their names change with their content).
// Pages: network first, falling back to the last copy of that page, else the offline page. Nothing else is touched:
// server actions, the API, the walk commands (POST /api/commands, queued by the page itself), the export and the
// sign-in always go to the network.
const VERSION = "gassi-v2";
const OFFLINE = "/offline.html";
const ICONS = ["/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll([OFFLINE, ...ICONS])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const old = caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))));
  event.waitUntil(old.then(() => self.clients.claim()));
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // Only a page itself, not the login page a signed-out request was redirected to.
    if (res.ok && !res.redirected) (await caches.open(VERSION)).put(request, res.clone());
    return res;
  } catch {
    return (await caches.match(request)) ?? (await caches.match(OFFLINE));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || ICONS.includes(url.pathname)) return event.respondWith(cacheFirst(request));
  if (request.mode === "navigate" && !url.pathname.startsWith("/api/") && url.pathname !== "/export.csv") event.respondWith(networkFirst(request));
});

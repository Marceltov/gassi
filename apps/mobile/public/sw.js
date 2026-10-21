// Gassi's service worker: just enough for the installed app to open at once, with or without reception.
// - An app page (any app path, /woche too) comes from the kept app shell (index.html) at once, and the shell is taken
//   anew in the background: one bar or a captive network never holds up opening the app. A new version shows from the
//   next opening on. Before a shell is kept, the page comes from the network (and is kept).
// - The shell is kept with the files it names (the hashed bundles under /_expo/); bundles of older versions go.
// - Hashed build files (/_expo/, /assets/) come from the cache once kept: their names change with their content.
// - The server's own pages (/l/…, the link pages) and the API (/api/*, the OIDC routes too) always go to the network
//   and are never kept; nor is anything from another origin.
const CACHE = "gassi-shell-v2";
const SHELL = "/";

const hashed = (path) => path.startsWith("/_expo/") || path.startsWith("/assets/");
const serverOwn = (path) => path.startsWith("/api/") || path.startsWith("/l/") || path === "/health";
const isHtml = (res) => res.ok && (res.headers.get("content-type") ?? "").includes("text/html");

// Keeps `res` (the app's index.html, fetched now unless given) as the shell with the files it links, and drops the
// bundles no longer linked.
async function keepShell(given) {
  const res = given ?? (await fetch(SHELL, { cache: "no-store" }));
  if (!isHtml(res)) return;
  const html = await res.clone().text();
  const linked = [...html.matchAll(/(?:src|href)="(\/_expo\/[^"]+)"/g)].map((m) => m[1]);
  const cache = await caches.open(CACHE);
  await Promise.all(linked.map(async (path) => (await cache.match(path)) ?? cache.add(path)));
  await cache.put(SHELL, res);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/_expo/static/") && !linked.includes(path)) await cache.delete(req);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(keepShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || serverOwn(url.pathname)) return;

  // a file opened directly (/manifest.json, /icon.svg) is the server's, not an app page
  if (req.mode === "navigate" && !/\.[^/]*$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const kept = await caches.match(SHELL);
        if (kept) {
          event.waitUntil(keepShell().catch(() => {}));
          return kept;
        }
        const res = await fetch(req);
        if (isHtml(res)) event.waitUntil(keepShell(res.clone()).catch(() => {}));
        return res;
      })(),
    );
    return;
  }

  if (hashed(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const kept = await cache.match(req);
        if (kept) return kept;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});

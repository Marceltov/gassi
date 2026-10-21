// Gassi's service worker: just enough for the installed app to open without reception after the first visit.
// - A page (any app path, /woche too) comes from the network; without it, the kept app shell (index.html) answers.
// - The shell is kept with the files it names (the hashed bundles under /_expo/), taken anew on every page load
//   that reaches the network, so a new version is kept once it has been opened; bundles of older versions go.
// - Hashed build files (/_expo/, /assets/) come from the cache once kept: their names change with their content.
// - Nothing else is touched: the API (/api/*) always goes to the network and is never kept, nor are the link pages.
const CACHE = "gassi-shell-v1";
const SHELL = "/";

const hashed = (url) => url.origin === self.location.origin && (url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/"));

// Keeps the shell and the files it links, and drops the bundles no longer linked.
async function keepShell() {
  const res = await fetch(SHELL, { cache: "no-store" });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
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
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(
        (res) => {
          // the link pages (/l/…) and the OIDC routes are the server's own pages, not the shell
          if (res.ok && !url.pathname.startsWith("/l/")) event.waitUntil(keepShell().catch(() => {}));
          return res;
        },
        async () => (await caches.match(SHELL)) ?? Response.error(),
      ),
    );
    return;
  }

  if (hashed(url)) {
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

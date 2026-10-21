// The service worker (public/sw.js) run in a sandbox with a stand-in for the cache and the network: what it keeps as
// the app's shell, and what it leaves alone.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

const ORIGIN = "https://gassi.test";
const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../public/sw.js"), "utf8");

type Answer = { ok: boolean; status: number; redirected: boolean; url: string; headers: Headers; body: string; clone(): Answer; text(): Promise<string> };
const answer = (body: string, { type = "text/html", url = `${ORIGIN}/`, redirected = false, status = 200 } = {}): Answer => {
  const a: Answer = { ok: status < 300, status, redirected, url, headers: new Headers({ "content-type": type }), body, clone: () => a, text: async () => body };
  return a;
};
const shell = (...bundles: string[]) => answer(`<html><head>${bundles.map((b) => `<script src="${b}"></script>`).join("")}</head></html>`);

/** The worker with a cache holding `kept` (path → body) and a network answering `net` (path → answer). */
function worker(kept: Record<string, Answer>, net: Record<string, Answer>) {
  const store = new Map(Object.entries(kept));
  const path = (k: string | { url: string }) => new URL(typeof k === "string" ? k : k.url, ORIGIN).pathname;
  const cache = {
    match: async (k: string | { url: string }) => store.get(path(k)),
    put: async (k: string | { url: string }, v: Answer) => void store.set(path(k), v),
    add: async (k: string) => void store.set(path(k), net[path(k)] ?? answer("", { status: 404 })),
    keys: async () => [...store.keys()].map((p) => ({ url: ORIGIN + p })),
    delete: async (k: { url: string }) => store.delete(path(k)),
  };
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = { location: { origin: ORIGIN }, addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const caches = { open: async () => cache, match: cache.match, keys: async () => ["gassi-shell-v2"], delete: async () => true };
  const fetchFn = async (k: string | { url: string }) => net[path(k)] ?? answer("", { status: 404 });
  runInNewContext(SOURCE, { self, caches, fetch: fetchFn, URL, console });
  const install = async () => {
    const waits: Promise<unknown>[] = [];
    handlers.install({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { store, install };
}

test("a new shell is kept with its bundles, and the bundles no shell links any more go", async () => {
  const { store, install } = worker({ "/": shell("/_expo/static/js/web/old.js"), "/_expo/static/js/web/old.js": answer("old", { type: "text/javascript" }) }, { "/": shell("/_expo/static/js/web/new.js"), "/_expo/static/js/web/new.js": answer("new", { type: "text/javascript" }) });
  await install();
  expect([...store.keys()].sort()).toEqual(["/", "/_expo/static/js/web/new.js"]);
});

test("a page in front of the server (a login, a captive portal) is never kept as the shell, and the kept app stays", async () => {
  const kept = { "/": shell("/_expo/static/js/web/app.js"), "/_expo/static/js/web/app.js": answer("app", { type: "text/javascript" }) };
  const portals = [
    answer("<html>Anmelden</html>", { redirected: true, url: "https://login.example/" }), // a proxy's sign-in, redirected
    answer("<html>Willkommen im WLAN</html>", { url: "https://portal.example/" }), // answered from another origin
    answer("<html>Willkommen im WLAN</html>"), // in place of the app: no bundle of it linked
  ];
  for (const portal of portals) {
    const { store, install } = worker(kept, { "/": portal });
    await install();
    expect(store.get("/")).toBe(kept["/"]);
    expect([...store.keys()].sort()).toEqual(["/", "/_expo/static/js/web/app.js"]);
  }
});

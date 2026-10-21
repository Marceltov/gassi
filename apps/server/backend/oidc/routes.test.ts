import { beforeEach, describe, expect, test, vi } from "vitest";
import { setEnv, withEnv } from "../testing/env";
import { resetDiscoveryForTests } from "./flow";
import { oidcCallbackRoute, oidcStartRoute, type OidcDeps } from "./routes";
import { goodClaims, META, NOW, stubIssuer, type StubOptions } from "./testing";

withEnv();
beforeEach(() => resetDiscoveryForTests());

const BASE = "https://gassi.example";
const FAILED = "gassi://join?error=signin";
const WEB_FAILED = `${BASE}/join?error=signin`;
const cookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) => cookies(res).find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

let remember: ReturnType<typeof vi.fn<OidcDeps["remember"]>>;
let deviceLink: ReturnType<typeof vi.fn<OidcDeps["deviceLink"]>>;
beforeEach(() => {
  remember = vi.fn<OidcDeps["remember"]>(async (c) => ({ id: `p-${c.subject}`, name: c.name }));
  deviceLink = vi.fn<OidcDeps["deviceLink"]>(async (personId) => `for-${personId}`);
});

// Starts the app's (or the web app's) sign-in and returns what the callback needs: the flight cookie and the
// state/nonce sent.
async function start(o: StubOptions = {}, target = "app=1") {
  const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?${target}`), { fetch: stubIssuer("", o), now: () => NOW, remember, deviceLink });
  const to = new URL(res.headers.get("location")!);
  return { res, to, flight: cookieValue(res, "gassi_oidc")!, state: to.searchParams.get("state")!, nonce: to.searchParams.get("nonce")! };
}

function callback(flight: string | undefined, query: Record<string, string>, nonce: string, o: StubOptions = {}) {
  const headers = flight ? { cookie: `gassi_oidc=${flight}` } : undefined;
  return oidcCallbackRoute(new Request(`${BASE}/api/oidc/callback?${new URLSearchParams(query)}`, { headers }), { fetch: stubIssuer(nonce, o), now: () => NOW, remember, deviceLink });
}

describe("start", () => {
  test("redirects to the provider with PKCE and sets the flight cookie on /api/oidc for 10 minutes", async () => {
    const { res, to } = await start();
    expect(res.status).toBe(303);
    expect(to.origin + to.pathname).toBe(META.authorization_endpoint);
    expect(to.searchParams.get("redirect_uri")).toBe(`${BASE}/api/oidc/callback`);
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(cookies(res)[0]).toMatch(/^gassi_oidc=[^;]+; Path=\/api\/oidc; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/);
  });

  test("only the app and the web app sign in this way; no other target, and never one from the query", async () => {
    for (const query of ["", "?app=0", "?web=https://evil.example", "?to=https://evil.example"]) {
      const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start${query}`), { fetch: stubIssuer(""), now: () => NOW, remember, deviceLink });
      expect(res.status).toBe(400);
    }
  });

  test("an unreachable provider sends the web app back with an error", async () => {
    const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?web=1`), { fetch: async () => Promise.reject(new TypeError("down")), now: () => NOW, remember, deviceLink });
    expect(res.headers.get("location")).toBe(WEB_FAILED);
  });

  test("an unreachable provider sends the app back with an error", async () => {
    const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?app=1`), { fetch: async () => Promise.reject(new TypeError("down")), now: () => NOW, remember, deviceLink });
    expect(res.headers.get("location")).toBe(FAILED);
  });

  test("without OIDC configured the routes don't exist", async () => {
    setEnv({ OIDC_ISSUER: undefined, OIDC_CLIENT_ID: undefined, OIDC_CLIENT_SECRET: undefined });
    expect((await oidcStartRoute(new Request(`${BASE}/api/oidc/start?app=1`))).status).toBe(404);
  });
});

describe("callback", () => {
  test("ends in the app with a one-time link for whoever the provider names, and remembers their name", async () => {
    const { flight, state, nonce } = await start();
    const res = await callback(flight, { state, code: "c" }, nonce);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("gassi://join?server=https%3A%2F%2Fgassi.example&token=for-p-sub-marcel");
    expect(cookieValue(res, "gassi_oidc")).toBe("");
    expect(remember).toHaveBeenCalledWith({ subject: "sub-marcel", name: "Hirsch" });
    expect(deviceLink).toHaveBeenCalledWith("p-sub-marcel");
  });

  test("started from the web app, it ends in the web app on the same server with the one-time link's token", async () => {
    const { flight, state, nonce } = await start({}, "web=1");
    const res = await callback(flight, { state, code: "c" }, nonce);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/join?token=for-p-sub-marcel`);
    expect(cookieValue(res, "gassi_oidc")).toBe("");
  });

  test("a failed sign-in from the web app ends in the web app with an error", async () => {
    const { flight, state, nonce } = await start({}, "web=1");
    const res = await callback(flight, { state, error: "access_denied" }, nonce);
    expect(res.headers.get("location")).toBe(WEB_FAILED);
    expect(remember).not.toHaveBeenCalled();
  });

  test.each([
    ["a state that doesn't match the flight", { state: "forged", code: "c" }, {}],
    ["a provider error", { error: "access_denied" }, {}],
    ["a bad id_token", { code: "c" }, { claims: (n: string) => goodClaims(n, { aud: "other" }) }],
  ])("%s ends in the app with an error and signs nobody in", async (_, query, o) => {
    const { flight, state, nonce } = await start();
    const res = await callback(flight, { state, ...query }, nonce, o as StubOptions);
    expect(res.headers.get("location")).toBe(FAILED);
    expect(remember).not.toHaveBeenCalled();
  });

  test("no flight cookie fails", async () => {
    const { state, nonce } = await start();
    expect((await callback(undefined, { state, code: "c" }, nonce)).headers.get("location")).toBe(FAILED);
  });
});

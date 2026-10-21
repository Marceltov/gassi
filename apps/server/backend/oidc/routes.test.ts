import { beforeEach, describe, expect, test, vi } from "vitest";
import { setEnv, withEnv } from "../testing/env";
import { resetDiscoveryForTests } from "./flow";
import { oidcCallbackRoute, oidcStartRoute, type OidcDeps } from "./routes";
import { goodClaims, META, NOW, stubIssuer, type StubOptions } from "./testing";

withEnv();
beforeEach(() => resetDiscoveryForTests());

const BASE = "https://gassi.example";
const FAILED = "gassi://join?error=signin";
const cookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) => cookies(res).find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

let remember: ReturnType<typeof vi.fn<OidcDeps["remember"]>>;
let appLink: ReturnType<typeof vi.fn<OidcDeps["appLink"]>>;
beforeEach(() => {
  remember = vi.fn<OidcDeps["remember"]>(async (c) => ({ id: `p-${c.subject}`, name: c.name }));
  appLink = vi.fn<OidcDeps["appLink"]>(async (personId) => `gassi://join?server=x&token=for-${personId}`);
});

// Starts the app's sign-in and returns what the callback needs: the flight cookie and the state/nonce sent.
async function start(o: StubOptions = {}) {
  const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?app=1`), { fetch: stubIssuer("", o), now: () => NOW, remember, appLink });
  const to = new URL(res.headers.get("location")!);
  return { res, to, flight: cookieValue(res, "gassi_oidc")!, state: to.searchParams.get("state")!, nonce: to.searchParams.get("nonce")! };
}

function callback(flight: string | undefined, query: Record<string, string>, nonce: string, o: StubOptions = {}) {
  const headers = flight ? { cookie: `gassi_oidc=${flight}` } : undefined;
  return oidcCallbackRoute(new Request(`${BASE}/api/oidc/callback?${new URLSearchParams(query)}`, { headers }), { fetch: stubIssuer(nonce, o), now: () => NOW, remember, appLink });
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

  test("only the app signs in this way for now (the dashboard comes later)", async () => {
    const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start`), { fetch: stubIssuer(""), now: () => NOW, remember, appLink });
    expect(res.status).toBe(400);
  });

  test("an unreachable provider sends the app back with an error", async () => {
    const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?app=1`), { fetch: async () => Promise.reject(new TypeError("down")), now: () => NOW, remember, appLink });
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
    expect(res.headers.get("location")).toBe("gassi://join?server=x&token=for-p-sub-marcel");
    expect(cookieValue(res, "gassi_oidc")).toBe("");
    expect(remember).toHaveBeenCalledWith({ subject: "sub-marcel", name: "Hirsch" });
    expect(appLink).toHaveBeenCalledWith("p-sub-marcel");
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

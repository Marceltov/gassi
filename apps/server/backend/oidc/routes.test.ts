import { beforeEach, describe, expect, test, vi } from "vitest";
import { sessionUser } from "../auth/session";
import { withEnv } from "../testing/env";
import { resetDiscoveryForTests } from "./flow";
import { logoutRoute, oidcCallbackRoute, oidcStartRoute, type OidcDeps } from "./routes";
import { goodClaims, META, NOW, stubIssuer, type StubOptions } from "./testing";

withEnv();
beforeEach(() => resetDiscoveryForTests());

const BASE = "https://gassi.example";
const cookies = (res: Response) => res.headers.getSetCookie();
const cookieValue = (res: Response, name: string) => cookies(res).find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

// Starts a sign-in and returns what the callback needs: the flight cookie and the state/nonce the provider was sent.
async function start(next?: string, o: StubOptions = {}) {
  const fetch = stubIssuer("", o);
  const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start${next ? `?next=${encodeURIComponent(next)}` : ""}`), { fetch, now: () => NOW, remember: vi.fn() });
  const to = new URL(res.headers.get("location")!);
  return { res, to, flight: cookieValue(res, "gassi_oidc")!, state: to.searchParams.get("state")!, nonce: to.searchParams.get("nonce")! };
}

let remember: ReturnType<typeof vi.fn<OidcDeps["remember"]>>;
beforeEach(() => void (remember = vi.fn<OidcDeps["remember"]>(async (c) => ({ id: `p-${c.subject}`, name: c.name }))));

function callback(flight: string | undefined, query: Record<string, string>, nonce: string, o: StubOptions = {}) {
  const deps: OidcDeps = { fetch: stubIssuer(nonce, o), now: () => NOW, remember };
  const headers = flight ? { cookie: `gassi_oidc=${flight}` } : undefined;
  return oidcCallbackRoute(new Request(`${BASE}/api/oidc/callback?${new URLSearchParams(query)}`, { headers }), deps);
}

describe("start", () => {
  test("redirects to the provider with PKCE and sets the flight cookie on /api/oidc for 10 minutes", async () => {
    const { res, to } = await start("/verlauf");
    expect(res.status).toBe(303);
    expect(to.origin + to.pathname).toBe(META.authorization_endpoint);
    expect(to.searchParams.get("redirect_uri")).toBe(`${BASE}/api/oidc/callback`);
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(cookies(res)[0]).toMatch(/^gassi_oidc=[^;]+; Path=\/api\/oidc; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/);
  });

  test("an unreachable provider goes back to the login page with an error", async () => {
    const res = await oidcStartRoute(new Request(`${BASE}/api/oidc/start?next=/verlauf`), { fetch: async () => Promise.reject(new TypeError("down")), now: () => NOW, remember: vi.fn() });
    expect(res.headers.get("location")).toBe("/login?error=1&next=%2Fverlauf");
  });
});

describe("callback", () => {
  test("signs in whoever authentik names, remembers their name and goes where the sign-in started", async () => {
    const { flight, state, nonce } = await start("/verlauf?type=walk");
    const res = await callback(flight, { state, code: "c" }, nonce);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/verlauf?type=walk");
    expect(sessionUser(cookieValue(res, "gassi_session"), NOW)).toEqual({ id: "p-marcel", name: "Hirsch" });
    expect(cookieValue(res, "gassi_oidc")).toBe("");
    expect(remember).toHaveBeenCalledWith({ subject: "marcel", name: "Hirsch" });
  });

  test("a state that doesn't match the flight fails", async () => {
    const { flight, nonce } = await start();
    const res = await callback(flight, { state: "forged", code: "c" }, nonce);
    expect(res.headers.get("location")).toBe("/login?error=1");
    expect(cookieValue(res, "gassi_session")).toBeUndefined();
    expect(remember).not.toHaveBeenCalled();
  });

  test("no flight cookie fails", async () => {
    const { state, nonce } = await start();
    expect((await callback(undefined, { state, code: "c" }, nonce)).headers.get("location")).toBe("/login?error=1");
  });

  test("a provider error fails", async () => {
    const { flight, state, nonce } = await start();
    expect((await callback(flight, { state, error: "access_denied" }, nonce)).headers.get("location")).toBe("/login?error=1");
  });

  test("a bad id_token fails", async () => {
    const { flight, state, nonce } = await start();
    const res = await callback(flight, { state, code: "c" }, nonce, { claims: (n) => goodClaims(n, { aud: "other" }) });
    expect(res.headers.get("location")).toBe("/login?error=1");
  });

  test("anyone authentik signs in gets a session, under their own name", async () => {
    const { flight, state, nonce } = await start();
    const res = await callback(flight, { state, code: "c" }, nonce, { claims: (n) => goodClaims(n, { preferred_username: "gast", name: "Gast" }) });
    expect(sessionUser(cookieValue(res, "gassi_session"), NOW)).toEqual({ id: "p-gast", name: "Gast" });
    expect(remember).toHaveBeenCalledWith({ subject: "gast", name: "Gast" });
  });

  test.each(["//evil.example", "https://evil.example/", "/\\evil.example"])("an open redirect in next (%j) goes home instead", async (next) => {
    const { flight, state, nonce } = await start(next);
    expect((await callback(flight, { state, code: "c" }, nonce)).headers.get("location")).toBe("/");
  });
});

test("logout clears the session and goes to the login page", () => {
  const res = logoutRoute();
  expect(res.headers.get("location")).toBe("/login");
  expect(cookieValue(res, "gassi_session")).toBe("");
});

import { beforeEach, describe, expect, test } from "vitest";
import { AuthError } from "./log";
import { authorizeUrl, discover, exchange, resetDiscoveryForTests } from "./flow";
import { CLIENT, goodClaims, ISSUER, jwt, META, NOW, stubIssuer } from "./testing";

const P = { code: "the-code", redirectUri: "https://gassi.example/api/oidc/callback", verifier: "the-verifier", nonce: "the-nonce" };

beforeEach(() => resetDiscoveryForTests());

describe("discover", () => {
  test("reads the issuer's openid-configuration, once per hour", async () => {
    const f = stubIssuer(P.nonce);
    expect(await discover(CLIENT, f, NOW)).toEqual(META);
    await discover(CLIENT, f, NOW + 3_599_000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(`${ISSUER}.well-known/openid-configuration`, expect.anything());
    await discover(CLIENT, f, NOW + 3_601_000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test("a document naming another issuer fails", async () => {
    await expect(discover(CLIENT, stubIssuer(P.nonce, { doc: { ...META, issuer: "https://evil.example" } }), NOW)).rejects.toThrow(AuthError);
  });

  test("a plain http endpoint fails", async () => {
    await expect(discover(CLIENT, stubIssuer(P.nonce, { doc: { ...META, token_endpoint: "http://idp.example/token" } }), NOW)).rejects.toThrow(AuthError);
  });

  test("a plain http issuer fails before anything is fetched, unless it is loopback", async () => {
    const f = stubIssuer(P.nonce);
    await expect(discover({ ...CLIENT, issuer: "http://idp.example" }, f, NOW)).rejects.toThrow(AuthError);
    expect(f).not.toHaveBeenCalled();
    await expect(discover({ ...CLIENT, issuer: "http://127.0.0.1:3199" }, f, NOW)).rejects.toThrow(AuthError); // fetched, 404
    expect(f).toHaveBeenCalledTimes(1);
  });

  test("an unreachable issuer fails", async () => {
    await expect(discover(CLIENT, async () => Promise.reject(new TypeError("fetch failed")), NOW)).rejects.toThrow(AuthError);
  });
});

test("authorizeUrl asks for a code with PKCE S256, state, nonce and the scopes", () => {
  const url = new URL(authorizeUrl(CLIENT, META, { redirectUri: P.redirectUri, state: "s", nonce: "n", challenge: "c" }));
  expect(url.origin + url.pathname).toBe(META.authorization_endpoint);
  expect(Object.fromEntries(url.searchParams)).toEqual({ response_type: "code", client_id: "gassi", redirect_uri: P.redirectUri, scope: "openid profile email", state: "s", nonce: "n", code_challenge: "c", code_challenge_method: "S256" });
});

describe("exchange", () => {
  test("sends the code with the verifier and returns the preferred_username", async () => {
    const f = stubIssuer(P.nonce);
    expect(await exchange(CLIENT, META, P, f, NOW)).toEqual({ username: "marcel" });
    const [, init] = f.mock.calls[0];
    expect(Object.fromEntries(new URLSearchParams(String(init!.body)))).toMatchObject({ grant_type: "authorization_code", code: "the-code", code_verifier: "the-verifier", client_id: "gassi", client_secret: "client-secret", redirect_uri: P.redirectUri });
  });

  test("several audiences need azp to name this client", async () => {
    const f = stubIssuer(P.nonce, { claims: (n) => goodClaims(n, { aud: ["gassi", "other"], azp: "gassi" }) });
    expect(await exchange(CLIENT, META, P, f, NOW)).toEqual({ username: "marcel" });
  });

  test.each<[string, Record<string, unknown>]>([
    ["iss", { iss: "https://evil.example" }],
    ["aud", { aud: "other" }],
    ["azp with several audiences", { aud: ["gassi", "other"] }],
    ["azp naming another client", { azp: "other" }],
    ["exp in the past", { exp: NOW / 1000 }],
    ["exp missing", { exp: undefined }],
    ["nonce", { nonce: "another-nonce" }],
    ["preferred_username missing", { preferred_username: undefined }],
  ])("a bad %s fails", async (_, bad) => {
    await expect(exchange(CLIENT, META, P, stubIssuer(P.nonce, { claims: (n) => goodClaims(n, bad) }), NOW)).rejects.toThrow(AuthError);
  });

  test.each([undefined, "not-a-jwt", jwt("a string").replace(/\..*\./, ".!!.")])("an id_token %j fails", async (idToken) => {
    await expect(exchange(CLIENT, META, P, stubIssuer(P.nonce, { idToken }), NOW)).rejects.toThrow(AuthError);
  });

  test("a rejected code fails", async () => {
    await expect(exchange(CLIENT, META, P, stubIssuer(P.nonce, { tokenStatus: 400 }), NOW)).rejects.toThrow(AuthError);
  });
});

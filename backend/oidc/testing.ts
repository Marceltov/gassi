// For tests: a stub issuer, passed as `fetch`. It serves the discovery document and a token endpoint that answers with
// an unsigned id_token carrying `claims`.
import { vi } from "vitest";

export const ISSUER = "https://idp.example/application/o/gassi/";
export const META = { issuer: ISSUER, authorization_endpoint: "https://idp.example/authorize", token_endpoint: "https://idp.example/token" };
export const CLIENT = { issuer: ISSUER, clientId: "gassi", clientSecret: "client-secret" };
export const NOW = 1_800_000_000_000;

export const goodClaims = (nonce: string, more: Record<string, unknown> = {}) => ({ iss: ISSUER, aud: "gassi", exp: NOW / 1000 + 300, nonce, preferred_username: "marcel", ...more });

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
export const jwt = (claims: unknown) => `${b64({ alg: "RS256" })}.${b64(claims)}.c2ln`;

export type StubOptions = { doc?: unknown; claims?: (nonce: string) => unknown; tokenStatus?: number; idToken?: unknown };

/** `claims` gets the nonce the test expects; by default the claims are good ones for marcel. */
export function stubIssuer(nonce: string, o: StubOptions = {}) {
  return vi.fn<typeof fetch>(async (url) => {
    if (String(url) === "https://idp.example/application/o/gassi/.well-known/openid-configuration") return Response.json(o.doc ?? META);
    if (String(url) === META.token_endpoint) {
      if (o.tokenStatus && o.tokenStatus !== 200) return Response.json({ error: "invalid_grant" }, { status: o.tokenStatus });
      const idToken = "idToken" in o ? o.idToken : jwt((o.claims ?? goodClaims)(nonce));
      return Response.json({ access_token: "at", token_type: "Bearer", id_token: idToken });
    }
    return new Response("not found", { status: 404 });
  });
}

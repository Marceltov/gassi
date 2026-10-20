// The OIDC relying party for one provider: discovery (cached for an hour), the authorize URL (code + PKCE S256, state,
// nonce) and the code exchange with the id_token's claims checked. Every failure logs why (log.ts) and throws an
// AuthError. Outside calls come in as `fetchFn` and `now`, so tests pass a stub issuer instead of mocking.
import { processState } from "../state";
import { errorCode, fail, logUrl } from "./log";

export type Client = { issuer: string; clientId: string; clientSecret: string };
export type Meta = { issuer: string; authorization_endpoint: string; token_endpoint: string };
type Fetch = typeof fetch;

const HOUR = 3_600_000;
const cache = processState("oidc-discovery", () => new Map<string, { at: number; meta: Meta }>());
export const resetDiscoveryForTests = (): void => cache.clear();

// Issuers compare exactly except for one trailing slash, which names the same provider.
const bare = (issuer: string) => issuer.replace(/\/$/, "");
const sameIssuer = (a: unknown, b: string) => typeof a === "string" && bare(a) === bare(b);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// TLS to the provider is what lets exchange() skip the id_token's signature: https, or plain http on loopback only.
export function secureUrl(v: unknown): v is string {
  if (typeof v !== "string" || !URL.canParse(v)) return false;
  const u = new URL(v);
  return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
}

// The network error's code (ENOTFOUND, ECONNREFUSED) when undici gives one, else its name.
function netError(e: unknown): string {
  const code = (e as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof code === "string" ? code : e instanceof Error ? e.name : "unknown";
}

// The JSON object the provider answers with; anything else fails as `reason`, with the status and its short error code.
async function getJson(fetchFn: Fetch, url: string, init: RequestInit, reason: string): Promise<Record<string, unknown>> {
  let res: Response;
  let body: unknown;
  try {
    res = await fetchFn(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
    body = await res.json().catch(() => undefined);
  } catch (e) {
    return fail(reason, { error: netError(e) });
  }
  if (!res.ok) return fail(reason, { status: res.status, ...(isObject(body) ? errorCode(body.error) : {}) });
  if (!isObject(body)) return fail(reason, { status: res.status, error: "not a JSON object" });
  return body;
}

function checkDocument(doc: Record<string, unknown>, issuer: string): Meta {
  if (!sameIssuer(doc.issuer, issuer)) fail("issuer does not match the discovery document", { issuer: logUrl(issuer), document: logUrl(doc.issuer) });
  const { authorization_endpoint, token_endpoint } = doc;
  if (!secureUrl(authorization_endpoint)) fail("discovery endpoint is not https", { endpoint: "authorization_endpoint" });
  if (!secureUrl(token_endpoint)) fail("discovery endpoint is not https", { endpoint: "token_endpoint" });
  return { issuer, authorization_endpoint, token_endpoint };
}

export async function discover(client: Client, fetchFn: Fetch = fetch, now = Date.now()): Promise<Meta> {
  const key = bare(client.issuer);
  const hit = cache.get(key);
  if (hit && now - hit.at < HOUR) return hit.meta;
  if (!secureUrl(client.issuer)) fail("issuer is not an https URL", { issuer: logUrl(client.issuer) });
  const doc = await getJson(fetchFn, `${key}/.well-known/openid-configuration`, { headers: { accept: "application/json" } }, "discovery failed");
  const meta = checkDocument(doc, client.issuer);
  cache.set(key, { at: now, meta });
  return meta;
}

export type AuthorizeParams = { redirectUri: string; state: string; nonce: string; challenge: string };

export function authorizeUrl(client: Client, meta: Meta, p: AuthorizeParams): string {
  const u = new URL(meta.authorization_endpoint);
  const query = { response_type: "code", client_id: client.clientId, redirect_uri: p.redirectUri, scope: "openid profile email", state: p.state, nonce: p.nonce, code_challenge: p.challenge, code_challenge_method: "S256" };
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return u.href;
}

// The id_token's payload, unverified: see the note in exchange().
function payload(idToken: unknown): Record<string, unknown> {
  if (typeof idToken !== "string") fail("token response has no id_token");
  const parts = idToken.split(".");
  let claims: unknown;
  try {
    if (parts.length === 3) claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {}
  return isObject(claims) ? claims : fail("id_token invalid", { check: "malformed" });
}

// OIDC Core 3.1.3.7: issuer, audience (azp whenever there are several audiences, or one is given), expiry, nonce.
function checkClaims(client: Client, c: Record<string, unknown>, meta: Meta, nonce: string, now: number): void {
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  const invalid = (check: string) => fail("id_token invalid", { check });
  if (!sameIssuer(c.iss, meta.issuer)) invalid("iss");
  if (!aud.includes(client.clientId)) invalid("aud");
  if ((aud.length !== 1 || c.azp !== undefined) && c.azp !== client.clientId) invalid("azp");
  if (typeof c.exp !== "number" || c.exp * 1000 <= now) invalid("exp");
  if (c.nonce !== nonce) invalid("nonce");
}

export type ExchangeParams = { code: string; redirectUri: string; verifier: string; nonce: string };

// The display name: the provider's `name`, else `preferred_username`, else a placeholder the person can change.
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const displayName = (c: Record<string, unknown>) => text(c.name) ?? text(c.preferred_username) ?? "Gassi-Nutzer";

/** Trades the code for an id_token and returns who it names: the stable subject (`sub`) and a display name. */
export async function exchange(client: Client, meta: Meta, p: ExchangeParams, fetchFn: Fetch = fetch, now = Date.now()): Promise<{ subject: string; name: string }> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, code_verifier: p.verifier, client_id: client.clientId, client_secret: client.clientSecret });
  const headers = { accept: "application/json", "content-type": "application/x-www-form-urlencoded" };
  const res = await getJson(fetchFn, meta.token_endpoint, { method: "POST", headers, body }, "token request rejected");
  // The id_token's signature is not verified: it came straight from the token endpoint over TLS, which OIDC Core
  // 3.1.3.7 lets stand in for it. Verify against the provider's JWKS if tokens ever arrive another way.
  const claims = payload(res.id_token);
  checkClaims(client, claims, meta, p.nonce, now);
  const subject = claims.sub;
  if (typeof subject !== "string" || subject === "") fail("id_token has no sub");
  return { subject, name: displayName(claims) };
}

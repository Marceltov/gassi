// GET /api/oidc/start, GET /api/oidc/callback and POST /logout. What a sign-in in flight needs (state, nonce, PKCE
// verifier, where to go next) rides in a short-lived signed cookie that only /api/oidc receives, so nothing is stored.
// authentik decides who may sign in (its application bindings): whoever it signs in gets the session cookie, and their
// display name is remembered for the entries they log.
import { createHash, randomBytes } from "node:crypto";
import { clearCookie, readCookie, setCookie } from "../auth/cookies";
import { endSessionCookie, sessionCookie, type User } from "../auth/session";
import { safeEqual, signer } from "../auth/signed";
import { config } from "../config";
import { secret } from "../secret";
import { database } from "../db/open";
import { safeNext, seeOther } from "../http/responses";
import { PeopleRepository } from "../people";
import { authorizeUrl, type Client, discover, exchange } from "./flow";
import { AuthError, errorCode, fail, log } from "./log";

/** Outside calls: the provider (`fetch`), the clock, and where a signed-in person's name is kept. */
export type OidcDeps = { fetch: typeof fetch; now: () => number; remember: (claims: { subject: string; name: string }) => Promise<User> };
const defaultDeps: OidcDeps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  remember: async (claims) => new PeopleRepository(await database()).signInOidc(claims),
};

type Flight = { state: string; nonce: string; verifier: string; next: string };

const FLIGHT_COOKIE = "gassi_oidc";
const FLIGHT_PATH = "/api/oidc";
const FLIGHT_TTL = 600;

const client = (): Client => {
  const oidc = config().oidc;
  if (!oidc) throw new Error("OIDC is not configured");
  return oidc;
};
const redirectUri = () => `${config().publicUrl}/api/oidc/callback`;
const secure = () => config().publicUrl.startsWith("https:");
const random = (bytes: number) => randomBytes(bytes).toString("base64url");
const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

const flightCookie = (value: string) => setCookie(FLIGHT_COOKIE, value, { maxAge: FLIGHT_TTL, path: FLIGHT_PATH, secure: secure() });
const noFlightCookie = () => clearCookie(FLIGHT_COOKIE, { path: FLIGHT_PATH, secure: secure() });

function loginFailed(next: string): Response {
  const query = new URLSearchParams({ error: "1", ...(next === "/" ? {} : { next }) });
  return seeOther(`/login?${query}`, { "Set-Cookie": noFlightCookie() });
}

export async function oidcStartRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  let meta;
  try {
    meta = await discover(client(), deps.fetch, deps.now());
  } catch (e) {
    if (e instanceof AuthError) return loginFailed(next);
    throw e;
  }
  const flight: Flight = { state: random(16), nonce: random(16), verifier: random(32), next };
  const to = authorizeUrl(client(), meta, { redirectUri: redirectUri(), state: flight.state, nonce: flight.nonce, challenge: challengeOf(flight.verifier) });
  return seeOther(to, { "Set-Cookie": flightCookie(signer(secret(config().secret, config().dataDir)).sign("oidc", flight, FLIGHT_TTL, deps.now())) });
}

// Throws AuthError (logging why) unless the provider's answer matches the flight; returns who the id_token names.
async function signIn(params: URLSearchParams, flight: Flight | null, deps: OidcDeps): Promise<{ subject: string; name: string }> {
  const [state, code] = [params.get("state"), params.get("code")];
  if (params.has("error")) fail("provider denied the sign-in", errorCode(params.get("error")));
  if (!flight || state === null || !safeEqual(state, flight.state)) fail("state mismatch or missing sign-in cookie");
  if (!code) fail("no code in the callback");
  const meta = await discover(client(), deps.fetch, deps.now());
  const who = await exchange(client(), meta, { code, redirectUri: redirectUri(), verifier: flight.verifier, nonce: flight.nonce }, deps.fetch, deps.now());
  return { subject: who.username, name: who.name };
}

export async function oidcCallbackRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const flight = signer(secret(config().secret, config().dataDir)).verify<Flight>("oidc", readCookie(req.headers, FLIGHT_COOKIE) ?? "", deps.now());
  const next = safeNext(flight?.next);
  let claims: { subject: string; name: string };
  try {
    claims = await signIn(new URL(req.url).searchParams, flight, deps);
  } catch (e) {
    if (e instanceof AuthError) return loginFailed(next);
    throw e;
  }
  const user = await deps.remember(claims);
  log.info("sign-in succeeded"); // never who
  const res = seeOther(next, { "Set-Cookie": sessionCookie(user, deps.now()) });
  res.headers.append("Set-Cookie", noFlightCookie());
  return res;
}

export function logoutRoute(): Response {
  return seeOther("/login", { "Set-Cookie": endSessionCookie() });
}

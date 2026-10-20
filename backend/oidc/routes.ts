// GET /api/oidc/start, GET /api/oidc/callback and POST /logout. What a sign-in in flight needs (state, nonce, PKCE
// verifier, where to go next) rides in a short-lived signed cookie that only /api/oidc receives, so nothing is stored.
// Success sets the session cookie; someone not in USERS gets a 403 page, never an account.
import { createHash, randomBytes } from "node:crypto";
import { clearCookie, readCookie, setCookie } from "../auth/cookies";
import { endSessionCookie, knownUser, sessionCookie } from "../auth/session";
import { safeEqual, signer } from "../auth/signed";
import { config } from "../config";
import { htmlPage, safeNext, seeOther } from "../http/responses";
import { authorizeUrl, type Client, discover, exchange } from "./flow";
import { AuthError, errorCode, fail, log } from "./log";

export type OidcDeps = { fetch: typeof fetch; now: () => number };
const defaultDeps: OidcDeps = { fetch: (...args) => fetch(...args), now: () => Date.now() };

type Flight = { state: string; nonce: string; verifier: string; next: string };

const FLIGHT_COOKIE = "gassi_oidc";
const FLIGHT_PATH = "/api/oidc";
const FLIGHT_TTL = 600;

const client = (): Client => config().oidc;
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
  return seeOther(to, { "Set-Cookie": flightCookie(signer(config().secret).sign("oidc", flight, FLIGHT_TTL, deps.now())) });
}

// Throws AuthError (logging why) unless the provider's answer matches the flight; returns the id_token's username.
async function signIn(params: URLSearchParams, flight: Flight | null, deps: OidcDeps): Promise<string> {
  const [state, code] = [params.get("state"), params.get("code")];
  if (params.has("error")) fail("provider denied the sign-in", errorCode(params.get("error")));
  if (!flight || state === null || !safeEqual(state, flight.state)) fail("state mismatch or missing sign-in cookie");
  if (!code) fail("no code in the callback");
  const meta = await discover(client(), deps.fetch, deps.now());
  const { username } = await exchange(client(), meta, { code, redirectUri: redirectUri(), verifier: flight.verifier, nonce: flight.nonce }, deps.fetch, deps.now());
  return username;
}

function forbidden(): Response {
  log.warn("person not in USERS"); // never who
  const res = htmlPage(403, "Kein Zugang", "Dieses Konto darf Gassi nicht benutzen. Frag im Haushalt nach, ob du in die Liste aufgenommen werden sollst.", { href: "/login", label: "Zurück zur Anmeldung" });
  res.headers.append("Set-Cookie", noFlightCookie());
  return res;
}

export async function oidcCallbackRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const flight = signer(config().secret).verify<Flight>("oidc", readCookie(req.headers, FLIGHT_COOKIE) ?? "", deps.now());
  const next = safeNext(flight?.next);
  let username: string;
  try {
    username = await signIn(new URL(req.url).searchParams, flight, deps);
  } catch (e) {
    if (e instanceof AuthError) return loginFailed(next);
    throw e;
  }
  if (!knownUser(username)) return forbidden();
  log.info("sign-in succeeded");
  const res = seeOther(next, { "Set-Cookie": sessionCookie(username, deps.now()) });
  res.headers.append("Set-Cookie", noFlightCookie());
  return res;
}

export function logoutRoute(): Response {
  return seeOther("/login", { "Set-Cookie": endSessionCookie() });
}

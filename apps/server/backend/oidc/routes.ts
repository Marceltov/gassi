// GET /api/oidc/start?app=1 (or ?web=1) and GET /api/oidc/callback, only while OIDC is configured: the app or the web
// app signs in through the household's provider. What a sign-in in flight needs (state, nonce, PKCE verifier, and
// which of the two started it) rides in a short-lived signed cookie that only /api/oidc receives. The provider
// decides who may sign in; whoever it signs in becomes a person of the household (found by `sub`), and the sign-in
// ends where it started with a one-time device link: gassi://join?… in the app, <PUBLIC_URL>/join?token=… in the web
// app — or, on any failure, with ?error=signin there. Only these two fixed targets exist; nothing in the request
// names a URL.
import { createHash, randomBytes } from "node:crypto";
import { clearCookie, readCookie, setCookie } from "../auth/cookies";
import { appLink, Links, MAGIC_TTL, webLink } from "../auth/links";
import { safeEqual, signer } from "../auth/signed";
import { config } from "../config";
import { database } from "../db/open";
import { ensureFirstDog } from "../dogs";
import { seeOther } from "../http/responses";
import { PeopleRepository } from "../people";
import { linkCodeKey, secret } from "../secret";
import { authorizeUrl, type Client, discover, exchange } from "./flow";
import { AuthError, errorCode, fail, log } from "./log";

/** Outside calls: the provider (`fetch`), the clock, where a signed-in person is kept, and the link back into the app. */
export type OidcDeps = {
  fetch: typeof fetch;
  now: () => number;
  remember: (claims: { subject: string; name: string }) => Promise<{ id: string; name: string }>;
  /** The token of a one-time link that signs a new device of `personId` in. */
  deviceLink: (personId: string) => Promise<string>;
};
const defaultDeps: OidcDeps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  remember: async (claims) => {
    const db = await database();
    const person = await new PeopleRepository(db).signInOidc(claims);
    await ensureFirstDog(db, config().defaultDogName, () => new Date()); // the first sign-in sets the household up
    return person;
  },
  deviceLink: async (personId) => (await new Links(await database(), () => new Date(), config().publicUrl, linkCodeKey(config().secret, config().dataDir)).create({ kind: "device", personId, ttlMs: MAGIC_TTL })).token,
};

/** Where the sign-in started, and so where it ends. */
type Target = "app" | "web";
type Flight = { state: string; nonce: string; verifier: string; to: Target };

const FLIGHT_COOKIE = "gassi_oidc";
const FLIGHT_PATH = "/api/oidc";
const FLIGHT_TTL = 600;
/** Where a failed sign-in ends: the app (or web app) shows that it didn't work. */
export const SIGN_IN_FAILED = "gassi://join?error=signin";
const failedUrl = (to: Target) => (to === "web" ? `${config().publicUrl}/join?error=signin` : SIGN_IN_FAILED);
const doneUrl = (to: Target, token: string) => (to === "web" ? webLink(config().publicUrl, token) : appLink(config().publicUrl, token));

const redirectUri = () => `${config().publicUrl}/api/oidc/callback`;
const secure = () => config().publicUrl.startsWith("https:");
const random = (bytes: number) => randomBytes(bytes).toString("base64url");
const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const flightSigner = () => signer(secret(config().secret, config().dataDir));

const flightCookie = (value: string) => setCookie(FLIGHT_COOKIE, value, { maxAge: FLIGHT_TTL, path: FLIGHT_PATH, secure: secure() });
const noFlightCookie = () => clearCookie(FLIGHT_COOKIE, { path: FLIGHT_PATH, secure: secure() });
const failed = (to: Target) => seeOther(failedUrl(to), { "Set-Cookie": noFlightCookie() });
const notFound = () => new Response("Gibt es nicht.", { status: 404 });

export async function oidcStartRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const client = config().oidc;
  if (!client) return notFound();
  const query = new URL(req.url).searchParams;
  const to: Target | null = query.get("app") === "1" ? "app" : query.get("web") === "1" ? "web" : null;
  if (!to) return new Response("Die Anmeldung über OIDC gibt es nur in der App und in der Web-App.", { status: 400 });
  let meta;
  try {
    meta = await discover(client, deps.fetch, deps.now());
  } catch (e) {
    if (e instanceof AuthError) return failed(to);
    throw e;
  }
  const flight: Flight = { state: random(16), nonce: random(16), verifier: random(32), to };
  const provider = authorizeUrl(client, meta, { redirectUri: redirectUri(), state: flight.state, nonce: flight.nonce, challenge: challengeOf(flight.verifier) });
  return seeOther(provider, { "Set-Cookie": flightCookie(flightSigner().sign("oidc", flight, FLIGHT_TTL, deps.now())) });
}

// Throws AuthError (logging why) unless the provider's answer matches the flight; returns who the id_token names.
async function signIn(client: Client, params: URLSearchParams, flight: Flight | null, deps: OidcDeps): Promise<{ subject: string; name: string }> {
  const [state, code] = [params.get("state"), params.get("code")];
  if (params.has("error")) fail("provider denied the sign-in", errorCode(params.get("error")));
  if (!flight || state === null || !safeEqual(state, flight.state)) fail("state mismatch or missing sign-in cookie");
  if (!code) fail("no code in the callback");
  const meta = await discover(client, deps.fetch, deps.now());
  return exchange(client, meta, { code, redirectUri: redirectUri(), verifier: flight.verifier, nonce: flight.nonce }, deps.fetch, deps.now());
}

export async function oidcCallbackRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const client = config().oidc;
  if (!client) return notFound();
  const flight = flightSigner().verify<Flight>("oidc", readCookie(req.headers, FLIGHT_COOKIE) ?? "", deps.now());
  // without a flight there is no telling where the sign-in started: the app, as before the web app came
  const to: Target = flight?.to === "web" ? "web" : "app";
  let claims: { subject: string; name: string };
  try {
    claims = await signIn(client, new URL(req.url).searchParams, flight, deps);
  } catch (e) {
    if (e instanceof AuthError) return failed(to);
    throw e;
  }
  const person = await deps.remember(claims);
  log.info("sign-in succeeded"); // never who
  return seeOther(doneUrl(to, await deps.deviceLink(person.id)), { "Set-Cookie": noFlightCookie() });
}

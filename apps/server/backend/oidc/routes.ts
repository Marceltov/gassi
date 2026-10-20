// GET /api/oidc/start?app=1 and GET /api/oidc/callback, only while OIDC is configured: the app signs in through the
// household's provider. What a sign-in in flight needs (state, nonce, PKCE verifier) rides in a short-lived signed
// cookie that only /api/oidc receives. The provider decides who may sign in; whoever it signs in becomes a person of
// the household (found by `sub`), and the sign-in ends in the app with a one-time device link — or, on any failure,
// with gassi://join?error=signin. (The dashboard's browser sign-in comes with step 4.)
import { createHash, randomBytes } from "node:crypto";
import { clearCookie, readCookie, setCookie } from "../auth/cookies";
import { appLink as appLinkFor, Links, MAGIC_TTL } from "../auth/links";
import { safeEqual, signer } from "../auth/signed";
import { config } from "../config";
import { database } from "../db/open";
import { ensureFirstDog } from "../dogs";
import { seeOther } from "../http/responses";
import { PeopleRepository } from "../people";
import { secret } from "../secret";
import { authorizeUrl, type Client, discover, exchange } from "./flow";
import { AuthError, errorCode, fail, log } from "./log";

/** Outside calls: the provider (`fetch`), the clock, where a signed-in person is kept, and the link back into the app. */
export type OidcDeps = {
  fetch: typeof fetch;
  now: () => number;
  remember: (claims: { subject: string; name: string }) => Promise<{ id: string; name: string }>;
  /** A one-time link (gassi://join…) that signs a new device of `personId` in. */
  appLink: (personId: string) => Promise<string>;
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
  appLink: async (personId) => {
    const { publicUrl } = config();
    const { token } = await new Links(await database(), () => new Date(), publicUrl).create({ kind: "device", personId, ttlMs: MAGIC_TTL });
    return appLinkFor(publicUrl, token);
  },
};

type Flight = { state: string; nonce: string; verifier: string };

const FLIGHT_COOKIE = "gassi_oidc";
const FLIGHT_PATH = "/api/oidc";
const FLIGHT_TTL = 600;
/** Where a failed sign-in ends: the app shows that it didn't work. */
export const SIGN_IN_FAILED = "gassi://join?error=signin";

const redirectUri = () => `${config().publicUrl}/api/oidc/callback`;
const secure = () => config().publicUrl.startsWith("https:");
const random = (bytes: number) => randomBytes(bytes).toString("base64url");
const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const flightSigner = () => signer(secret(config().secret, config().dataDir));

const flightCookie = (value: string) => setCookie(FLIGHT_COOKIE, value, { maxAge: FLIGHT_TTL, path: FLIGHT_PATH, secure: secure() });
const noFlightCookie = () => clearCookie(FLIGHT_COOKIE, { path: FLIGHT_PATH, secure: secure() });
const failed = () => seeOther(SIGN_IN_FAILED, { "Set-Cookie": noFlightCookie() });
const notFound = () => new Response("Gibt es nicht.", { status: 404 });

export async function oidcStartRoute(req: Request, deps: OidcDeps = defaultDeps): Promise<Response> {
  const client = config().oidc;
  if (!client) return notFound();
  if (new URL(req.url).searchParams.get("app") !== "1") return new Response("Die Anmeldung über OIDC gibt es vorerst nur in der App.", { status: 400 });
  let meta;
  try {
    meta = await discover(client, deps.fetch, deps.now());
  } catch (e) {
    if (e instanceof AuthError) return failed();
    throw e;
  }
  const flight: Flight = { state: random(16), nonce: random(16), verifier: random(32) };
  const to = authorizeUrl(client, meta, { redirectUri: redirectUri(), state: flight.state, nonce: flight.nonce, challenge: challengeOf(flight.verifier) });
  return seeOther(to, { "Set-Cookie": flightCookie(flightSigner().sign("oidc", flight, FLIGHT_TTL, deps.now())) });
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
  let claims: { subject: string; name: string };
  try {
    claims = await signIn(client, new URL(req.url).searchParams, flight, deps);
  } catch (e) {
    if (e instanceof AuthError) return failed();
    throw e;
  }
  const person = await deps.remember(claims);
  log.info("sign-in succeeded"); // never who
  return seeOther(await deps.appLink(person.id), { "Set-Cookie": noFlightCookie() });
}

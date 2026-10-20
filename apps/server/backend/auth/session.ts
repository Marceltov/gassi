// The session cookie: a signed {id, name, exp}, 30 days. authentik decides who may sign in; whoever it signed in
// keeps the session until it expires or they sign out.
import { config } from "../config";
import { secret } from "../secret";
import { clearCookie, setCookie } from "./cookies";
import { signer } from "./signed";

export const SESSION_COOKIE = "gassi_session";
export const SESSION_TTL = 30 * 24 * 3600;

export type User = { id: string; name: string };

const secure = () => config().publicUrl.startsWith("https:");

export function sessionCookie(user: User, now = Date.now()): string {
  const value = signer(secret(config().secret, config().dataDir)).sign("session", { id: user.id, name: user.name }, SESSION_TTL, now);
  return setCookie(SESSION_COOKIE, value, { maxAge: SESSION_TTL, secure: secure() });
}

export const endSessionCookie = (): string => clearCookie(SESSION_COOKIE, { secure: secure() });

/** Who the session cookie's value names, or null when it is missing, forged or expired. */
export function sessionUser(value: string | undefined, now = Date.now()): User | null {
  if (!value) return null;
  const claims = signer(secret(config().secret, config().dataDir)).verify<{ id?: unknown; name?: unknown }>("session", value, now);
  if (!claims || typeof claims.id !== "string" || typeof claims.name !== "string") return null;
  return { id: claims.id, name: claims.name };
}

// The session cookie: a signed {username, name, exp}, 30 days. authentik decides who may sign in; whoever it signed in
// keeps the session until it expires or they sign out.
import { config } from "../config";
import { clearCookie, setCookie } from "./cookies";
import { signer } from "./signed";

export const SESSION_COOKIE = "gassi_session";
export const SESSION_TTL = 30 * 24 * 3600;

export type User = { username: string; name: string };

const secure = () => config().publicUrl.startsWith("https:");

export function sessionCookie(user: User, now = Date.now()): string {
  const value = signer(config().secret).sign("session", { username: user.username, name: user.name }, SESSION_TTL, now);
  return setCookie(SESSION_COOKIE, value, { maxAge: SESSION_TTL, secure: secure() });
}

export const endSessionCookie = (): string => clearCookie(SESSION_COOKIE, { secure: secure() });

/** Who the session cookie's value names, or null when it is missing, forged or expired. */
export function sessionUser(value: string | undefined, now = Date.now()): User | null {
  if (!value) return null;
  const claims = signer(config().secret).verify<{ username?: unknown; name?: unknown }>("session", value, now);
  if (!claims || typeof claims.username !== "string" || typeof claims.name !== "string") return null;
  return { username: claims.username, name: claims.name };
}

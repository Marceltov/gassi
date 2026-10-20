// The session cookie: a signed {username, exp}, 30 days. A session counts only while its username is still in USERS,
// so taking someone out of the config signs them out.
import { config } from "../config";
import { clearCookie, setCookie } from "./cookies";
import { signer } from "./signed";

export const SESSION_COOKIE = "gassi_session";
export const SESSION_TTL = 30 * 24 * 3600;

export type User = { username: string; name: string };

const secure = () => config().publicUrl.startsWith("https:");

export function sessionCookie(username: string, now = Date.now()): string {
  const value = signer(config().secret).sign("session", { username }, SESSION_TTL, now);
  return setCookie(SESSION_COOKIE, value, { maxAge: SESSION_TTL, secure: secure() });
}

export const endSessionCookie = (): string => clearCookie(SESSION_COOKIE, { secure: secure() });

/** The known user a USERS username names, or null. */
export function knownUser(username: unknown): User | null {
  const name = typeof username === "string" ? config().users.get(username) : undefined;
  return name ? { username: username as string, name } : null;
}

/** Who the session cookie's value names, or null when it is missing, forged, expired or names someone no longer known. */
export function sessionUser(value: string | undefined, now = Date.now()): User | null {
  if (!value) return null;
  const claims = signer(config().secret).verify<{ username?: unknown }>("session", value, now);
  return claims && knownUser(claims.username);
}

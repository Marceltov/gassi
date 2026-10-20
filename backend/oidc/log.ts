// Why a sign-in failed, for the operator: the browser only ever sees "Anmelden hat nicht geklappt". One `warn` line on
// the `oidc` logger per failure: msg is a fixed reason, the detail its fields. Callers pass only issuer URLs, HTTP
// statuses, check names and short error codes: never a secret, code, token, state, nonce, verifier, cookie or claim.
import { logger } from "../log";

type Detail = Record<string, string | number>;

export const log = logger("oidc");

/** A sign-in that must not go on. The routes word it for the browser. */
export class AuthError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "AuthError";
  }
}

// Never throws: a failing log must not change what the browser sees.
export function logFailure(reason: string, detail: Detail = {}): void {
  try {
    log.warn(detail, reason);
  } catch {}
}

/** Logs why, then refuses. */
export function fail(reason: string, detail?: Detail): never {
  logFailure(reason, detail);
  throw new AuthError(reason);
}

/** A URL as logged: without userinfo, query or fragment, which may carry credentials. */
export function logUrl(v: unknown): string {
  if (typeof v !== "string" || !URL.canParse(v)) return typeof v === "string" ? "(not a URL)" : typeof v;
  return v.replace(/[?#].*$/s, "").replace(/^([a-z][a-z\d+.-]*:\/\/)[^/]*@/i, "$1");
}

/** A provider's error code (`invalid_grant`, `access_denied`) when it is one; anything longer is left out. */
export const errorCode = (v: unknown): Detail => (typeof v === "string" && /^[\w.-]{1,64}$/.test(v) ? { error: v } : {});

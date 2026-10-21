// Stateless signed values for the cookies: base64url(JSON payload) "." base64url(HMAC-SHA256). The payload carries its
// kind and its expiry, so a value signed for one cookie never passes as another, and none outlives its time.
import { createHmac, timingSafeEqual } from "node:crypto";

export type Signer = {
  sign(kind: string, payload: object, ttlSeconds: number, now?: number): string;
  verify<T extends object>(kind: string, token: string, now?: number): T | null;
};

type Claims = { k?: unknown; exp?: unknown };

function parse(body: string): Claims | null {
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    return claims && typeof claims === "object" && !Array.isArray(claims) ? claims : null;
  } catch {
    return null;
  }
}

export function signer(secret: string): Signer {
  const mac = (body: string) => createHmac("sha256", secret).update(body).digest();
  return {
    sign(kind, payload, ttlSeconds, now = Date.now()) {
      const body = Buffer.from(JSON.stringify({ ...payload, k: kind, exp: Math.floor(now / 1000) + ttlSeconds })).toString("base64url");
      return `${body}.${mac(body).toString("base64url")}`;
    },
    verify<T extends object>(kind: string, token: string, now = Date.now()) {
      const [body, sig, ...rest] = token.split(".");
      if (!body || !sig || rest.length > 0) return null;
      const want = mac(body);
      const got = Buffer.from(sig, "base64url");
      // The round trip rejects non-canonical encodings (the last character of a 32-byte MAC has spare bits).
      if (got.length !== want.length || got.toString("base64url") !== sig || !timingSafeEqual(got, want)) return null;
      const claims = parse(body);
      if (!claims || claims.k !== kind || typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
      return claims as T;
    },
  };
}

/** Compares two strings in constant time (for their length). */
export function safeEqual(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

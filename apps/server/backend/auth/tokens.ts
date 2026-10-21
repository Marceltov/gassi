// Tokens for devices and links: long random strings handed out once; the server keeps only their SHA-256.
// A link also has a short code to type (an installed web app on iPhone doesn't share storage with Safari, where a link
// from Mail opens): 8 Crockford base32 symbols, 40 bits, kept only as a hash like the token. It is derived from the
// link's random token (a separate hash, so the token's stored hash doesn't give it away), which lets the landing page
// show it again from the token alone.
import { createHash, randomBytes } from "node:crypto";

export const newToken = (): string => randomBytes(32).toString("base64url");

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** The code of a link's token, as shown: `XXXX-XXXX`; each symbol is 5 uniform bits of a SHA-256. */
export function codeFor(token: string): string {
  const bytes = createHash("sha256").update(`gassi-code:${token}`).digest();
  let bits = 0n;
  for (const b of bytes.subarray(0, 5)) bits = (bits << 8n) | BigInt(b);
  const symbols = Array.from({ length: 8 }, (_, i) => CROCKFORD[Number((bits >> BigInt(35 - 5 * i)) & 31n)]).join("");
  return `${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

/** A typed code as stored: upper case, spaces and dashes dropped, O read as 0, I and L as 1 (Crockford). */
export const normalizeCode = (input: string): string => input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

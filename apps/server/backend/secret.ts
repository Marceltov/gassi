// The key for signed cookies (the OIDC sign-in's state) and, derived from it, for the hashes of link codes: SECRET if
// set, else one kept in ${DATA_DIR}/secret, created on first use, readable by the server only. Self-hosters don't have
// to make one up.
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function secret(fromEnv: string | null, dataDir: string): string {
  if (fromEnv) return fromEnv;
  const file = join(dataDir, "secret");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    mkdirSync(dataDir, { recursive: true });
    const made = randomBytes(32).toString("hex");
    writeFileSync(file, `${made}\n`, { mode: 0o600, flag: "wx" });
    return made;
  }
}

/** The key for the hashes of link codes (tokens.ts), derived from the secret so the cookie key isn't reused as it is. */
export const linkCodeKey = (fromEnv: string | null, dataDir: string): string => createHmac("sha256", secret(fromEnv, dataDir)).update("link-code").digest("hex");

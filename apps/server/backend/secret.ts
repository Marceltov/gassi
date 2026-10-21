// The key for signed cookies (the OIDC sign-in's state): SECRET if set, else one kept in ${DATA_DIR}/secret, created
// on first use, readable by the server only. Self-hosters don't have to make one up.
import { randomBytes } from "node:crypto";
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

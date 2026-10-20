// What has to work before the first request: the configuration (every variable checked) and the database (opened,
// migrated). instrumentation.ts runs this and stops the process when it throws. It prints the setup link while nobody
// has set the server up, and starts the daily backup.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSetupLink } from "./auth/links";
import { startBackups } from "./backup";
import { config } from "./config";
import { database } from "./db/open";
import { logger } from "./log";
import { processState } from "./state";

const state = processState("backups", () => ({ started: false }));

export async function startup(): Promise<void> {
  const { timeZone, dataDir, oidc, smtp, publicUrl, setupLinkFile } = config();
  const db = await database();
  logger("startup").info({ timeZone, oidc: oidc ? "on" : "off", mail: smtp ? "on" : "off" }, "gassi started");
  // The link holds a token, so it is a plain line for whoever runs the server, not a log event that might be shipped.
  await ensureSetupLink(db, publicUrl, (line) => {
    process.stdout.write(`${line}\n`);
    if (setupLinkFile) appendFileSync(setupLinkFile, `${line}\n`);
  });
  if (state.started) return;
  state.started = true;
  const log = logger("backup");
  // the daily copy of the database; a failure is logged and tried again the next hour, it never stops the app
  await startBackups({ db, dir: join(dataDir, "backups"), timeZone, onError: (e) => log.error({ err: e }, "backup failed"), onWritten: (path) => log.info({ path }, "backup written") });
}

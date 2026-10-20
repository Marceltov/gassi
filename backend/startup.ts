// What has to work before the first request: the configuration (every variable checked) and the database (opened,
// migrated, the dog created). instrumentation.ts runs this and stops the process when it throws.
import { config } from "./config";
import { database } from "./db/open";
import { logger } from "./log";

export async function startup(): Promise<void> {
  const { timeZone, apiToken } = config();
  await database();
  logger("startup").info({ timeZone, api: apiToken ? "on" : "off" }, "gassi started");
}

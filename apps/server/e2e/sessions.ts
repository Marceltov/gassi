// For browser specs that walk: the server is shared by every spec, so each test starts with nothing running and ends
// what it started, and a test that wants one dog puts the others aside (archived) and back afterwards.
import { readFileSync } from "node:fs";
import { createClient } from "@gassi/api-client";
import { BASE_URL, TOKEN_FILE } from "../playwright.config";

/** Hirsch's first device (from api.spec.ts): "the other phone". */
export const asHirsch = () => createClient({ baseUrl: BASE_URL, token: readFileSync(TOKEN_FILE, "utf8").trim() });

export async function stopEverything() {
  const client = asHirsch();
  const { walk, training } = await client.sessions();
  const at = new Date().toISOString();
  const commands = [
    ...(training ? [{ id: `stop-t-${Date.now()}`, at, kind: "training.stop" as const, trainingKey: training.key }] : []),
    ...(walk ? [{ id: `stop-w-${Date.now()}`, at, kind: "walk.stop" as const, walkKey: walk.key }] : []),
  ];
  if (commands.length) await client.commands({ commands });
}

/** Archives every active dog but the first; returns how to bring back those it archived. */
export async function onlyOneDog(): Promise<() => Promise<void>> {
  const client = asHirsch();
  const [, ...others] = (await client.dogs()).dogs.filter((d) => !d.archived);
  for (const d of others) await client.updateDog({ id: d.id, archived: true });
  return async () => {
    for (const d of others) await client.updateDog({ id: d.id, archived: false });
  };
}

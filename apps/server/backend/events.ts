// What happens in the app (#115, ADR 0016): errors with their stacks, screens, taps, commands, sync and recording
// health, kept per device in `client_event` for 30 days. A batch sent again stores nothing twice (the app's ids). The
// server's CLIENT_EVENTS says what it keeps: all, only errors, or nothing.
import type { ClientEvent, ClientEventWants } from "@gassi/api-client";
import type { DB } from "./db/open";

const KEEP_MS = 30 * 86_400_000;
const HOUR = 3_600_000;

type Batch = { events: ClientEvent[]; version: string; platform: string };

/** Keeps what the server wants of `batch`; the events stored now (not those it had already). */
export async function storeEvents(db: DB, deviceId: number, personId: string, batch: Batch, receivedAt: string, wants: ClientEventWants): Promise<ClientEvent[]> {
  const kept = batch.events.filter((e) => wants === "all" || (wants === "errors" && e.kind === "error"));
  // one transaction for the batch: one write to disk, not one per event
  return db.transaction().execute(async (tx) => {
    const stored: ClientEvent[] = [];
    for (const e of kept) {
      const row = { device_id: deviceId, id: e.id, person_id: personId, at: e.at, kind: e.kind, name: e.name, data: e.data ? JSON.stringify(e.data) : null, version: batch.version, platform: batch.platform, received_at: receivedAt };
      const r = await tx.insertInto("client_event").values(row).onConflict((oc) => oc.doNothing()).executeTakeFirst();
      if (Number(r.numInsertedOrUpdatedRows ?? 0) > 0) stored.push(e);
    }
    return stored;
  });
}

/** Deletes what was received over 30 days before `now`; how many. */
export async function dropOldEvents(db: DB, now: number): Promise<number> {
  const r = await db.deleteFrom("client_event").where("received_at", "<", new Date(now - KEEP_MS).toISOString()).executeTakeFirst();
  return Number(r.numDeletedRows);
}

type Cleanup = { db: DB; now?: () => number; every?: (fn: () => Promise<void>, ms: number) => void; onError: (e: unknown) => void };

/** Cleans now and then every hour; a failure goes to `onError` and is tried again the next hour. */
export async function startEventCleanup({ db, now = Date.now, every = (fn, ms) => setInterval(fn, ms).unref(), onError }: Cleanup): Promise<void> {
  const clean = async () => {
    try {
      await dropOldEvents(db, now());
    } catch (e) {
      onError(e);
    }
  };
  await clean();
  every(clean, HOUR);
}

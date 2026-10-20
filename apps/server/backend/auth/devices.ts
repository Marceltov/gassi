// A person's signed-in devices (phones, the watch, a browser, a script). Each holds a device token that never
// expires; signing a device out deletes it, and its token stops working with the next request.
import type { DB } from "../db/open";
import { hashToken, newToken } from "./tokens";

export type DeviceKind = "phone" | "watch" | "web" | "script";
export type DeviceInfo = { id: number; kind: DeviceKind; name: string };
export type Auth = { person: { id: string; name: string }; device: DeviceInfo };
export type DeviceListing = DeviceInfo & { createdAt: string; lastSeenAt: string | null };

const kind = (k: string): DeviceKind => (k === "watch" || k === "web" || k === "script" ? k : "phone");

export class Devices {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(personId: string, d: { kind: DeviceKind; name: string }): Promise<{ token: string; device: DeviceInfo }> {
    const token = newToken();
    const row = await this.db
      .insertInto("device")
      .values({ person_id: personId, kind: d.kind, name: d.name.trim().slice(0, 60) || "Gerät", token_hash: hashToken(token), created_at: this.now().toISOString() })
      .returning(["id", "kind", "name"])
      .executeTakeFirstOrThrow();
    return { token, device: { id: row.id, kind: kind(row.kind), name: row.name } };
  }

  /** Who an `Authorization: Bearer <token>` header belongs to, or null; stamps the device as seen. */
  async authenticate(authorization: string | null): Promise<Auth | null> {
    const token = /^Bearer ([\w-]+)$/.exec(authorization ?? "")?.[1];
    if (!token) return null;
    const row = await this.db
      .selectFrom("device")
      .innerJoin("person", "person.id", "device.person_id")
      .select(["device.id", "device.kind", "device.name", "person.id as person_id", "person.name as person_name"])
      .where("device.token_hash", "=", hashToken(token))
      .executeTakeFirst();
    if (!row) return null;
    await this.db.updateTable("device").set({ last_seen_at: this.now().toISOString() }).where("id", "=", row.id).execute();
    return { person: { id: row.person_id, name: row.person_name }, device: { id: row.id, kind: kind(row.kind), name: row.name } };
  }

  async list(personId: string): Promise<DeviceListing[]> {
    const rows = await this.db.selectFrom("device").select(["id", "kind", "name", "created_at", "last_seen_at"]).where("person_id", "=", personId).orderBy("created_at").orderBy("id").execute();
    return rows.map((r) => ({ id: r.id, kind: kind(r.kind), name: r.name, createdAt: r.created_at, lastSeenAt: r.last_seen_at }));
  }

  /** Signs out one of `personId`'s devices; false when it isn't theirs or doesn't exist. */
  async remove(personId: string, deviceId: number): Promise<boolean> {
    const r = await this.db.deleteFrom("device").where("id", "=", deviceId).where("person_id", "=", personId).executeTakeFirst();
    return r.numDeletedRows > 0n;
  }
}

// One-time links that let people and devices in, all redeemed the same way: the setup link (first person and dog),
// invites for a new person or another device of the inviting person (a phone, the watch), and magic links sent by
// e-mail. Each is used once, expires, and can be revoked by whoever made it. The server keeps only the token's hash.
// A link points to a page on the household's own server (/l/<token>) that opens the app; nothing central is involved.
// Each link also has a short code (tokens.ts) that redeems it the same way, for an app that can't be handed the link.
import type { DB } from "../db/open";
import { DogRepository, FIRST_DOG_COLOR } from "../dogs";
import { InputError } from "../errors";
import { PeopleRepository } from "../people";
import { type DeviceInfo, type DeviceKind, Devices } from "./devices";
import { codeFor, hashCode, hashToken, newToken, normalizeCode } from "./tokens";

export { codeFor, normalizeCode };

export type LinkKind = "setup" | "person" | "device" | "watch" | "magic";
export type OpenLink = { id: number; kind: LinkKind; createdAt: string; expiresAt: string };
/** What redeems a link: its token, or its code as typed. */
export type LinkKey = { token: string } | { code: string };
export type Redeemed = { deviceToken: string; person: { id: string; name: string }; device: DeviceInfo };

const DAY = 86_400_000;
export const SETUP_TTL = 7 * DAY;
export const INVITE_TTL = 7 * DAY;
export const MAGIC_TTL = 15 * 60_000;

const USED = "Dieser Link ist abgelaufen oder schon benutzt.";

/** A link or code that names no usable link: unknown, used, revoked or expired (one message for all). */
export class WrongLink extends InputError {
  constructor() {
    super(USED);
  }
}
const isKind = (k: string): k is LinkKind => ["setup", "person", "device", "watch", "magic"].includes(k);

/** gassi://join?server=…&token=…: what the landing page and the QR code hand to the app. */
export const appLink = (publicUrl: string, token: string): string => `gassi://join?server=${encodeURIComponent(publicUrl)}&token=${encodeURIComponent(token)}`;
/** /join?token=…: the same for the web app on the household's server. */
export const webLink = (publicUrl: string, token: string): string => `${publicUrl}/join?token=${encodeURIComponent(token)}`;

export class Links {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date,
    private readonly publicUrl: string,
    private readonly codeKey: string, // keys the codes' hashes (secret.ts linkCodeKey)
    private readonly defaultDogName: string | null = null, // DOG_NAME: the first dog's name when setup doesn't say
  ) {}

  async create(l: { kind: LinkKind; personId?: string | null; createdBy?: string | null; ttlMs: number }): Promise<{ id: number; token: string; code: string; url: string; expiresAt: string }> {
    const token = newToken();
    const code = codeFor(token);
    const now = this.now();
    const expiresAt = new Date(now.getTime() + l.ttlMs).toISOString();
    const row = await this.db
      .insertInto("link")
      .values({ token_hash: hashToken(token), code_hash: hashCode(this.codeKey, code), kind: l.kind, person_id: l.personId ?? null, created_by: l.createdBy ?? null, created_at: now.toISOString(), expires_at: expiresAt })
      .returning("id")
      .executeTakeFirstOrThrow();
    return { id: row.id, token, code, url: `${this.publicUrl}/l/${token}`, expiresAt };
  }

  /** What a link is for and whether it still works, without using it (for the landing page). */
  async peek(token: string): Promise<{ kind: LinkKind | null; valid: boolean }> {
    const row = await this.db.selectFrom("link").select(["kind", "used_at", "revoked_at", "expires_at"]).where("token_hash", "=", hashToken(token)).executeTakeFirst();
    if (!row || !isKind(row.kind)) return { kind: null, valid: false };
    return { kind: row.kind, valid: !row.used_at && !row.revoked_at && row.expires_at > this.now().toISOString() };
  }

  /** What an open link is for, by its token or code, without using it (the app asks for a name only when it needs one). */
  async info(key: LinkKey): Promise<{ kind: LinkKind }> {
    return { kind: (await this.usable(this.db, key)).kind };
  }

  /** Uses the link: adds the person (and, for setup, the first dog) or the device, in one transaction. */
  async redeem(key: LinkKey, d: { deviceKind: DeviceKind; deviceName: string; personName?: string; dogName?: string }): Promise<Redeemed> {
    return this.db.transaction().execute(async (tx) => {
      const now = this.now().toISOString();
      const link = await this.usable(tx, key);
      const people = new PeopleRepository(tx, this.now);
      let personId = link.person_id;
      if (link.kind === "setup" || link.kind === "person") {
        const name = d.personName?.trim().slice(0, 40);
        if (!name) throw new InputError("Wie heißt du?");
        if (link.kind === "setup") {
          const dogName = d.dogName?.trim() || this.defaultDogName;
          if (!dogName) throw new InputError("Wie heißt dein Hund?");
          await new DogRepository(tx, this.now).add({ name: dogName, color: FIRST_DOG_COLOR });
        }
        personId = (await people.add({ name })).id;
      }
      const person = personId ? await people.get(personId) : undefined;
      if (!person) throw new InputError(USED);
      const { token: deviceToken, device } = await new Devices(tx, this.now).create(person.id, { kind: d.deviceKind, name: d.deviceName });
      await tx.updateTable("link").set({ used_at: now }).where("id", "=", link.id).execute();
      return { deviceToken, person, device };
    });
  }

  // The link `key` names if it can still be used, else WrongLink for unknown, used, revoked and expired alike.
  private async usable(db: DB, key: LinkKey) {
    const [column, hash] = "code" in key ? (["code_hash", hashCode(this.codeKey, key.code)] as const) : (["token_hash", hashToken(key.token)] as const);
    const link = await db.selectFrom("link").selectAll().where(column, "=", hash).executeTakeFirst();
    if (!link || link.used_at || link.revoked_at || link.expires_at <= this.now().toISOString() || !isKind(link.kind)) throw new WrongLink();
    return { ...link, kind: link.kind };
  }

  /** The links `personId` made that can still be used. */
  async open(personId: string): Promise<OpenLink[]> {
    const rows = await this.db
      .selectFrom("link")
      .select(["id", "kind", "created_at", "expires_at"])
      .where("created_by", "=", personId)
      .where("used_at", "is", null)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", this.now().toISOString())
      .orderBy("created_at", "desc")
      .execute();
    return rows.filter((r) => isKind(r.kind)).map((r) => ({ id: r.id, kind: r.kind as LinkKind, createdAt: r.created_at, expiresAt: r.expires_at }));
  }

  async revoke(personId: string, id: number): Promise<boolean> {
    const r = await this.db.updateTable("link").set({ revoked_at: this.now().toISOString() }).where("id", "=", id).where("created_by", "=", personId).where("used_at", "is", null).executeTakeFirst();
    return r.numUpdatedRows > 0n;
  }
}

/** While nobody has set the server up (and no OIDC provider does it): a fresh setup link on each start (only its hash is kept, so an old one can't be
 * shown again; earlier unused ones are revoked). Returns the URL, or null once someone is in. */
export async function ensureSetupLink(db: DB, publicUrl: string, codeKey: string, print: (line: string) => void, now: () => Date = () => new Date(), { oidc = false } = {}): Promise<string | null> {
  if ((await new PeopleRepository(db).count()) > 0) return null;
  // with a provider, the provider decides who is in: its first sign-in sets the household up
  if (oidc) {
    print("Gassi wird über OIDC eingerichtet: die erste Anmeldung über den Anbieter legt den Haushalt an.");
    return null;
  }
  await db.updateTable("link").set({ revoked_at: now().toISOString() }).where("kind", "=", "setup").where("used_at", "is", null).where("revoked_at", "is", null).execute();
  const { url } = await new Links(db, now, publicUrl, codeKey).create({ kind: "setup", ttlMs: SETUP_TTL });
  print(`Gassi einrichten: ${url}`);
  return url;
}

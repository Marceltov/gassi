// The people of the household, by an id the server makes up, with the name others see and an optional e-mail address
// (for magic links) and OIDC subject (for sign-in through the household's provider).
import { randomBytes } from "node:crypto";
import type { DB } from "./db/open";
import { InputError } from "./errors";

export type Person = { id: string; name: string };

/** person id → name. */
export type Names = ReadonlyMap<string, string>;

export const newPersonId = (): string => randomBytes(9).toString("base64url");

export class PeopleRepository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async add(p: { name: string; email?: string | null; oidcSubject?: string | null; id?: string }): Promise<Person> {
    const row = { id: p.id ?? newPersonId(), name: p.name, email: p.email ?? null, oidc_subject: p.oidcSubject ?? null, created_at: this.now().toISOString() };
    await this.db.insertInto("person").values(row).execute();
    return { id: row.id, name: row.name };
  }

  /** The person the household's OIDC provider signed in, found by subject or added; their name follows the provider. */
  async signInOidc({ subject, name }: { subject: string; name: string }): Promise<Person> {
    const known = await this.db.selectFrom("person").select("id").where("oidc_subject", "=", subject).executeTakeFirst();
    if (!known) return this.add({ name, oidcSubject: subject });
    await this.db.updateTable("person").set({ name }).where("id", "=", known.id).execute();
    return { id: known.id, name };
  }

  /** Changes the name and/or e-mail address (null removes it); an address belongs to one person only. */
  async update(id: string, change: { name?: string; email?: string | null }): Promise<{ id: string; name: string; email: string | null }> {
    if (change.email) {
      const owner = await this.db.selectFrom("person").select("id").where("email", "=", change.email.toLowerCase()).executeTakeFirst();
      if (owner && owner.id !== id) throw new InputError("Diese E-Mail-Adresse gehört schon jemand anderem.");
    }
    const patch = { ...(change.name !== undefined ? { name: change.name } : {}), ...(change.email !== undefined ? { email: change.email?.toLowerCase() ?? null } : {}) };
    if (Object.keys(patch).length) await this.db.updateTable("person").set(patch).where("id", "=", id).execute();
    return this.db.selectFrom("person").select(["id", "name", "email"]).where("id", "=", id).executeTakeFirstOrThrow();
  }

  async get(id: string): Promise<Person | undefined> {
    return this.db.selectFrom("person").select(["id", "name"]).where("id", "=", id).executeTakeFirst();
  }

  async count(): Promise<number> {
    const r = await this.db.selectFrom("person").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow();
    return Number(r.n);
  }

  async names(): Promise<Names> {
    const rows = await this.db.selectFrom("person").select(["id", "name"]).orderBy("name").execute();
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}

// Everyone who has signed in, by username, with the display name authentik gave at their last sign-in. authentik
// decides who may sign in; this only remembers names, so entries and filters can show them.
import type { DB } from "./db/open";

export type Person = { username: string; name: string };

/** username → display name. */
export type Names = ReadonlyMap<string, string>;

export class PeopleRepository {
  constructor(private readonly db: DB) {}

  /** Adds someone or updates their name. */
  async remember(p: Person, now = new Date()): Promise<void> {
    await this.db
      .insertInto("person")
      .values({ username: p.username, name: p.name, updated_at: now.toISOString() })
      .onConflict((oc) => oc.column("username").doUpdateSet({ name: p.name, updated_at: now.toISOString() }))
      .execute();
  }

  async names(): Promise<Names> {
    const rows = await this.db.selectFrom("person").select(["username", "name"]).orderBy("name").execute();
    return new Map(rows.map((r) => [r.username, r.name]));
  }
}

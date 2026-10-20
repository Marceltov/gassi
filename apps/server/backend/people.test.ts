import { expect, test } from "vitest";
import { freshDatabase } from "./db/testing";
import { PeopleRepository } from "./people";

const { db } = freshDatabase();

test("remembers people by username, sorted by name, and keeps the latest name", async () => {
  const people = new PeopleRepository(db());
  await people.remember({ username: "marcel", name: "Marcel" });
  await people.remember({ username: "bille", name: "Herzii" });
  await people.remember({ username: "marcel", name: "Hirsch" });
  expect([...(await people.names())]).toEqual([
    ["bille", "Herzii"],
    ["marcel", "Hirsch"],
  ]);
});

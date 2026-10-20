import { expect, test } from "vitest";
import { freshDatabase } from "./db/testing";
import { PeopleRepository } from "./people";

const { db } = freshDatabase({ empty: true });
const people = () => new PeopleRepository(db(), () => new Date("2026-10-20T10:00:00Z"));

test("adds people with an id of their own; names come sorted by name", async () => {
  const hirsch = await people().add({ name: "Hirsch" });
  const herzii = await people().add({ name: "Herzii", email: "herzii@example.org" });
  expect(hirsch.id).toMatch(/^[\w-]{12}$/);
  expect([...(await people().names())]).toEqual([
    [herzii.id, "Herzii"],
    [hirsch.id, "Hirsch"],
  ]);
  expect(await people().count()).toBe(2);
});

test("an OIDC sign-in finds the person by subject, or adds them, and keeps the provider's latest name", async () => {
  const first = await people().signInOidc({ subject: "sub-1", name: "Marcel" });
  const again = await people().signInOidc({ subject: "sub-1", name: "Hirsch" });
  expect(again).toEqual({ id: first.id, name: "Hirsch" });
  expect(await people().count()).toBe(1);
});

import { expect, test } from "vitest";
import { checkDetails } from "./details";
import { entryFields, withDetail } from "./entry";

const fields = (details: unknown) => entryFields.parse({ at: "2026-10-20T10:00:00Z", details });

test("details: empty is none; an unknown one is refused", () => {
  expect(fields({ consistency: "soft" }).details).toEqual({ consistency: "soft" });
  expect(fields({}).details).toBeNull();
  expect(fields(undefined).details).toBeNull();
  expect(entryFields.safeParse({ at: "2026-10-20T10:00:00Z", details: { consistency: "lumpy" } }).success).toBe(false);
  expect(entryFields.safeParse({ at: "2026-10-20T10:00:00Z", details: { mood: "ok" } }).success).toBe(false);
});

test("a consistency only on a poop", () => {
  expect(checkDetails("poop", { consistency: "hard" })).toBeNull();
  expect(checkDetails("pee", { consistency: "hard" })).toBe("Das passt nicht zu dieser Art von Eintrag.");
  expect(checkDetails("pee", null)).toBeNull();
});

test("withDetail sets or takes out one detail; none left is null", () => {
  expect(withDetail(null, "consistency", "soft")).toEqual({ consistency: "soft" });
  expect(withDetail({ consistency: "soft" }, "consistency", "hard")).toEqual({ consistency: "hard" });
  expect(withDetail({ consistency: "soft" }, "consistency", null)).toBeNull();
});

test("an encounter needs what it is about: a dog's the reaction, a person's who and how it went", () => {
  expect(checkDetails("dogEncounter", { reaction: 2, handling: "wideBerth" })).toBeNull();
  expect(checkDetails("dogEncounter", { handling: "wideBerth" })).toBe("Wie stark hat er reagiert?");
  expect(checkDetails("personEncounter", { who: "Oma Inge", rating: 7, moods: ["friendly"], sounds: ["howls"] })).toBeNull();
  expect(checkDetails("personEncounter", { rating: 7 })).toBe("Wer?");
  expect(checkDetails("dogEncounter", { reaction: 1, who: "Oma Inge" })).toBe("Das passt nicht zu dieser Art von Eintrag.");
  expect(entryFields.safeParse({ at: "2026-10-20T10:00:00Z", details: { reaction: 5 } }).success).toBe(false);
  expect(entryFields.safeParse({ at: "2026-10-20T10:00:00Z", details: { rating: 11 } }).success).toBe(false);
});

import { describe, expect, test } from "vitest";
import { freshDatabase } from "./db/testing";
import { DogRepository, ensureFirstDog } from "./dogs";
import { InputError } from "./errors";

const { db } = freshDatabase({ empty: true });
const dogs = () => new DogRepository(db(), () => new Date("2026-10-20T10:00:00Z"));

describe("DogRepository", () => {
  test("add, rename, recolour and archive; archived dogs are listed only on request", async () => {
    const toffee = await dogs().add({ name: " Toffee ", color: "#c0813a" });
    const bruno = await dogs().add({ name: "Bruno", color: "#3a6fc0" });
    expect(toffee).toEqual({ id: toffee.id, name: "Toffee", color: "#c0813a", archived: false, marks: false });
    expect(await dogs().update(toffee.id, { marks: true })).toMatchObject({ name: "Toffee", marks: true });
    await dogs().update(toffee.id, { marks: false });
    await dogs().update(bruno.id, { name: "Bruno der Große", archived: true });
    expect(await dogs().list()).toEqual([toffee]);
    expect((await dogs().list({ withArchived: true })).map((d) => d.name)).toEqual(["Bruno der Große", "Toffee"]);
  });

  test("a dog name is 1–30 characters and a colour is #rrggbb", async () => {
    await expect(dogs().add({ name: "", color: "#000000" })).rejects.toThrow(new InputError("Der Name muss 1 bis 30 Zeichen lang sein."));
    await expect(dogs().add({ name: "x".repeat(31), color: "#000000" })).rejects.toThrow(InputError);
    await expect(dogs().add({ name: "Bruno", color: "blau" })).rejects.toThrow(new InputError("Die Farbe stimmt nicht."));
  });

  test("the last active dog can't be archived", async () => {
    const toffee = await dogs().add({ name: "Toffee", color: "#c0813a" });
    await expect(dogs().update(toffee.id, { archived: true })).rejects.toThrow(new InputError("Mindestens ein Hund muss bleiben."));
    const bruno = await dogs().add({ name: "Bruno", color: "#3a6fc0" });
    expect(await dogs().update(toffee.id, { archived: true })).toMatchObject({ archived: true });
    await expect(dogs().update(bruno.id, { archived: true })).rejects.toThrow(InputError);
  });

  test("the first OIDC sign-in into a household without dogs brings a first dog", async () => {
    expect(await ensureFirstDog(db(), null, () => new Date())).toMatchObject({ name: "Mein Hund" });
    expect(await ensureFirstDog(db(), "Toffee", () => new Date())).toBeNull(); // there is one already
    expect(await dogs().list()).toHaveLength(1);
  });

  test("a fresh database has no dogs (setup creates the first)", async () => {
    expect(await dogs().list({ withArchived: true })).toEqual([]);
  });
});

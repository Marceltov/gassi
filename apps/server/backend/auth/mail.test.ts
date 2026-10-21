import { expect, test } from "vitest";
import { freshDatabase, HIRSCH } from "../db/testing";
import { PeopleRepository } from "../people";
import { Links } from "./links";
import { type Mailer, sendMagicLink } from "./mail";

const { db } = freshDatabase();
const NOW = new Date("2026-10-20T10:00:00Z");
const URL_ = "https://gassi.example";
const recording = () => {
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = { send: async (to, subject, text) => void sent.push({ to, subject, text }) };
  return { sent, mailer };
};

test("a known address gets a mail with a 15-minute link that signs in that person", async () => {
  await new PeopleRepository(db()).update(HIRSCH.id, { email: "marcel@example.org" });
  const { sent, mailer } = recording();
  await sendMagicLink(db(), () => NOW, URL_, mailer, " Marcel@Example.org ");
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: "marcel@example.org", subject: "Dein Gassi-Link" });
  const token = /https:\/\/gassi\.example\/l\/([\w-]+)/.exec(sent[0].text)![1];
  expect(sent[0].text).toContain("15 Minuten");
  const code = /gib diesen Code ein: ([0-9A-Z]{4}-[0-9A-Z]{4})/.exec(sent[0].text)![1];
  const links = new Links(db(), () => NOW, URL_);
  expect(await links.peek(token)).toEqual({ kind: "magic", valid: true });
  expect((await links.redeem({ code }, { deviceKind: "phone", deviceName: "iPhone" })).person).toEqual(HIRSCH);
  await expect(links.redeem({ token }, { deviceKind: "phone", deviceName: "iPhone" })).rejects.toThrow("Dieser Link ist abgelaufen oder schon benutzt.");
  expect(await new Links(db(), () => new Date(NOW.getTime() + 15 * 60_000 + 1), URL_).peek(token)).toMatchObject({ valid: false });
});

test("an unknown address gets no mail and no hint that it is unknown", async () => {
  const { sent, mailer } = recording();
  await expect(sendMagicLink(db(), () => NOW, URL_, mailer, "nobody@example.org")).resolves.toBeUndefined();
  expect(sent).toEqual([]);
});

test("the answer doesn't wait for the mail (same timing for known and unknown addresses), and a failing send is no error", async () => {
  await new PeopleRepository(db()).update(HIRSCH.id, { email: "marcel@example.org" });
  const never: Mailer = { send: () => new Promise(() => {}) };
  const quick = await Promise.race([sendMagicLink(db(), () => NOW, URL_, never, "marcel@example.org").then(() => "answered"), new Promise((r) => setTimeout(() => r("waited"), 200))]);
  expect(quick).toBe("answered");
  const failing: Mailer = { send: async () => Promise.reject(new Error("smtp down")) };
  await expect(sendMagicLink(db(), () => new Date(NOW.getTime() + 61_000), URL_, failing, "marcel@example.org")).resolves.toBeUndefined();
});

test("at most one link a minute per person, so nobody's inbox can be flooded", async () => {
  await new PeopleRepository(db()).update(HIRSCH.id, { email: "marcel@example.org" });
  const { sent, mailer } = recording();
  await sendMagicLink(db(), () => NOW, URL_, mailer, "marcel@example.org");
  await sendMagicLink(db(), () => new Date(NOW.getTime() + 30_000), URL_, mailer, "marcel@example.org");
  await new Promise((r) => setTimeout(r, 10));
  expect(sent).toHaveLength(1);
  await sendMagicLink(db(), () => new Date(NOW.getTime() + 61_000), URL_, mailer, "marcel@example.org");
  await new Promise((r) => setTimeout(r, 10));
  expect(sent).toHaveLength(2);
});

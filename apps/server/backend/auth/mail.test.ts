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
  const links = new Links(db(), () => NOW, URL_);
  expect(await links.peek(token)).toEqual({ kind: "magic", valid: true });
  expect((await links.redeem(token, { deviceKind: "phone", deviceName: "iPhone" })).person).toEqual(HIRSCH);
  expect(await new Links(db(), () => new Date(NOW.getTime() + 15 * 60_000 + 1), URL_).peek(token)).toMatchObject({ valid: false });
});

test("an unknown address gets no mail and no hint that it is unknown", async () => {
  const { sent, mailer } = recording();
  await expect(sendMagicLink(db(), () => NOW, URL_, mailer, "nobody@example.org")).resolves.toBeUndefined();
  expect(sent).toEqual([]);
});

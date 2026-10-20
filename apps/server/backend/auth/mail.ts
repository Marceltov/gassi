// Magic links by e-mail, only where the household configured SMTP. A known address gets a 15-minute link that signs
// in a new device of its person; an unknown one gets nothing, and the answer is the same either way.
import nodemailer from "nodemailer";
import type { DB } from "../db/open";
import { Links, MAGIC_TTL } from "./links";

export type Mailer = { send(to: string, subject: string, text: string): Promise<void> };

export function smtpMailer(smtp: { url: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(smtp.url);
  return { send: async (to, subject, text) => void (await transport.sendMail({ from: smtp.from, to, subject, text })) };
}

export async function sendMagicLink(db: DB, now: () => Date, publicUrl: string, mailer: Mailer, email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const person = await db.selectFrom("person").select(["id", "name"]).where("email", "=", address).executeTakeFirst();
  if (!person) return;
  const { url } = await new Links(db, now, publicUrl).create({ kind: "magic", personId: person.id, ttlMs: MAGIC_TTL });
  await mailer.send(address, "Dein Gassi-Link", `Hallo ${person.name},\n\nmit diesem Link meldest du dich bei Gassi an. Er gilt 15 Minuten und nur einmal:\n\n${url}\n\nWenn du ihn nicht angefordert hast, kannst du diese Mail einfach löschen.\n`);
}

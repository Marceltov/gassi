// Magic links by e-mail, only where the household configured SMTP. A known address gets a 15-minute link (and its code,
// for the web app installed on an iPhone, which a link from Mail can't reach) that signs in a new device of its person; an unknown one gets nothing. The answer is the same either way and doesn't wait for
// the mail (its timing would tell known addresses apart), and a person gets at most one link a minute.
import nodemailer from "nodemailer";
import type { DB } from "../db/open";
import { logger } from "../log";
import { Links, MAGIC_TTL } from "./links";

const COOLDOWN_MS = 60_000;

export type Mailer = { send(to: string, subject: string, text: string): Promise<void> };

export function smtpMailer(smtp: { url: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(smtp.url);
  return { send: async (to, subject, text) => void (await transport.sendMail({ from: smtp.from, to, subject, text })) };
}

export async function sendMagicLink(db: DB, now: () => Date, publicUrl: string, mailer: Mailer, email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const person = await db.selectFrom("person").select(["id", "name"]).where("email", "=", address).executeTakeFirst();
  if (!person) return;
  const since = new Date(now().getTime() - COOLDOWN_MS).toISOString();
  const recent = await db.selectFrom("link").select("id").where("kind", "=", "magic").where("person_id", "=", person.id).where("created_at", ">", since).executeTakeFirst();
  if (recent) return;
  const { url, code } = await new Links(db, now, publicUrl).create({ kind: "magic", personId: person.id, ttlMs: MAGIC_TTL });
  const text = `Hallo ${person.name},\n\nmit diesem Link meldest du dich bei Gassi an. Er gilt 15 Minuten und nur einmal:\n\n${url}\n\nOder öffne Gassi und gib diesen Code ein: ${code}\n\nWenn du ihn nicht angefordert hast, kannst du diese Mail einfach löschen.\n`;
  void mailer.send(address, "Dein Gassi-Link", text).catch((err: unknown) => logger("mail").error({ err }, "magic link mail failed"));
}

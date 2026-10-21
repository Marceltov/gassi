// The page a link opens on the household's server (/l/<token>): what the link is for, a button that opens the app
// with the server's address and the token, and the same as a QR code for the app to scan; the link's code for the web
// app installed on the home screen (it doesn't share Safari's storage), and a way to sign in right here in the browser.
import { appLink, codeFor, type LinkKind, Links, webLink } from "../auth/links";
import type { DB } from "../db/open";
import { qrSvg } from "../qr";

export type Landing = { valid: true; title: string; hint: string; appLink: string; qr: string; code: string; webLink: string } | { valid: false; title: string; hint: string };

const TEXT: Record<LinkKind, { title: string; hint: string }> = {
  setup: { title: "Gassi einrichten", hint: "Öffne den Link in der Gassi-App: Du gibst deinen Namen und den deines Hundes ein, und der Server ist eingerichtet." },
  person: { title: "Du bist zu Gassi eingeladen", hint: "Öffne den Link in der Gassi-App und gib deinen Namen ein." },
  device: { title: "Ein weiteres Gerät verbinden", hint: "Öffne den Link in der Gassi-App auf dem neuen Gerät." },
  watch: { title: "Die Uhr verbinden", hint: "Die Gassi-App auf dem Handy gibt den Link an die Uhr weiter." },
  magic: { title: "Bei Gassi anmelden", hint: "Öffne den Link in der Gassi-App, um dich anzumelden." },
};

export async function landing(db: DB, now: () => Date, publicUrl: string, token: string): Promise<Landing> {
  const { kind, valid } = await new Links(db, now, publicUrl).peek(token);
  if (!kind || !valid) return { valid: false, title: "Dieser Link ist abgelaufen oder schon benutzt.", hint: "Bitte um einen neuen Link." };
  const link = appLink(publicUrl, token);
  return { valid: true, ...TEXT[kind], appLink: link, qr: await qrSvg(link), code: codeFor(token), webLink: webLink(publicUrl, token) };
}

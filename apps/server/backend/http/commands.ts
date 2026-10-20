// POST /api/commands: the taps of the walk and training screens, for whoever is signed in. Body { commands: [...] }
// (at most 100); answers which ids were applied or dropped and the walk and training as they are now.
import { z } from "zod";
import { commandSchema } from "@gassi/domain";
import { readCookie } from "../auth/cookies";
import { SESSION_COOKIE, sessionUser } from "../auth/session";
import { type Sessions, sessions } from "../sessions";

const bodySchema = z.object({ commands: z.array(commandSchema).max(100) });

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function commandsRoute(req: Request, open: () => Promise<Sessions> = sessions, now = Date.now()): Promise<Response> {
  const user = sessionUser(readCookie(req.headers, SESSION_COOKIE), now);
  if (!user) return json({ error: "Bitte erst anmelden." }, 401);
  // Only JSON: a cross-site form cannot send it, so this route needs no CSRF token beyond SameSite cookies.
  if (!/^application\/json\b/.test(req.headers.get("content-type") ?? "")) return json({ error: "body must be JSON" }, 415);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid commands" }, 400);
  const s = await open();
  const result = await s.apply(user, parsed.data.commands);
  return json({ ...result, view: await s.current() });
}

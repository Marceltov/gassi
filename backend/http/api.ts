// The REST API, only while API_TOKEN is set (404 otherwise): GET /api/v1/entries?type=&since= lists entries newest
// first, POST /api/v1/entries logs one on behalf of `loggedBy` (someone who has signed in). Bearer token auth, JSON in and out.
import { z } from "zod";
import { safeEqual } from "../auth/signed";
import { config } from "../config";
import { type Diary, diary, InputError } from "../diary";
import { isEntryType } from "../../shared/entryTypes";

type Open = () => Promise<Diary>;

const error = (status: number, message: string, headers: HeadersInit = {}) => Response.json({ error: message }, { status, headers });

// null when the request may go on, else the answer.
function refuse(req: Request): Response | null {
  const token = config().apiToken;
  if (!token) return error(404, "not found");
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!given || !safeEqual(given, token)) return error(401, "invalid or missing bearer token", { "WWW-Authenticate": "Bearer" });
  return null;
}

async function list(req: Request, open: Open): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const type = q.get("type") || undefined;
  const since = q.get("since") || undefined;
  if (type !== undefined && !isEntryType(type)) return error(400, "unknown type");
  if (since !== undefined && !z.iso.datetime({ offset: true }).safeParse(since).success) return error(400, "since must be an ISO 8601 date-time");
  const entries = await (await open()).all({ type, since: since && new Date(since).toISOString() });
  return Response.json({ entries });
}

async function create(req: Request, open: Open, now: () => Date): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "body must be a JSON object");
  const { loggedBy, ...input } = body as Record<string, unknown>;
  try {
    const entry = await (await open()).logAs(String(loggedBy ?? ""), { at: now().toISOString(), ...input });
    return Response.json(entry, { status: 201 });
  } catch (e) {
    if (e instanceof InputError) return error(400, e.message);
    throw e;
  }
}

export async function apiEntriesRoute(req: Request, open: Open = diary, now = () => new Date()): Promise<Response> {
  const refused = refuse(req);
  if (refused) return refused;
  return req.method === "POST" ? create(req, open, now) : list(req, open);
}

// Serves the contract (packages/api-client): finds the endpoint for method and path, checks the device token unless
// the endpoint is public, parses the input with the endpoint's schema, runs its implementation and checks the answer
// with the output schema. `Implementations` has a key per endpoint, so a missing one doesn't compile.
import { contract, type Contract, type EndpointName, matchPath, type Output, type ParsedInput, sendsBody } from "@gassi/api-client";
import type { Auth } from "../auth/devices";
import { InputError } from "../errors";

type AuthFor<K extends EndpointName> = Contract[K]["auth"] extends true ? Auth : Auth | null;
export type Handler<K extends EndpointName, D> = (ctx: { input: ParsedInput<K>; auth: AuthFor<K>; deps: D }) => Promise<Output<K>>;
export type Implementations<D> = { [K in EndpointName]: Handler<K, D> };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** A 404 from inside a handler ("Diesen Eintrag gibt es nicht."). */
export class NotFound extends Error {}

export function router<D>(impls: Implementations<D>, deps: D, authenticate: (authorization: string | null) => Promise<Auth | null>) {
  const routes = (Object.keys(contract) as EndpointName[]).map((name) => ({ name, e: contract[name] }));
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    let found: { name: EndpointName; params: Record<string, string> } | null = null;
    for (const { name, e } of routes) {
      const params = e.method === req.method ? matchPath(e.path, url.pathname) : null;
      if (params) found = { name, params };
    }
    if (!found) return json({ error: "Gibt es nicht." }, 404);
    const e = contract[found.name];
    const auth = await authenticate(req.headers.get("authorization"));
    if (e.auth && !auth) return json({ error: "Bitte anmelden." }, 401);
    let raw: Record<string, unknown> = Object.fromEntries(url.searchParams);
    if (sendsBody(e.method)) {
      const body: unknown = await req.json().catch(() => undefined);
      if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) return json({ error: "Die Anfrage braucht einen JSON-Inhalt." }, 400);
      raw = body as Record<string, unknown>;
    }
    const input = e.input.safeParse({ ...raw, ...found.params });
    if (!input.success) return json({ error: "Die Eingabe stimmt nicht.", issues: input.error.issues.map((i) => i.path.join(".")) }, 400);
    try {
      const handler = impls[found.name] as Handler<EndpointName, D>;
      const out = await handler({ input: input.data as never, auth: auth as never, deps });
      return json(e.output.parse(out));
    } catch (err) {
      if (err instanceof InputError) return json({ error: err.message }, 400);
      if (err instanceof NotFound) return json({ error: err.message || "Gibt es nicht." }, 404);
      throw err;
    }
  };
}

// A stand-in for the server in tests: answers per "METHOD /path", records what was asked, and can be switched off
// (fetch then rejects, as a browser's does without reception).
type Handler = (body: unknown, url: URL) => unknown;
type Answer = { status: number; body: unknown };

/** A handler's answer with a status other than 200. */
export const status = (code: number, body: unknown): Answer => ({ status: code, body });
const isAnswer = (v: unknown): v is Answer => typeof v === "object" && v !== null && "status" in v && "body" in v && Object.keys(v).length === 2;

export function fakeServer(handlers: Record<string, Handler>) {
  const calls: { route: string; body: unknown; headers: Record<string, string> }[] = [];
  const server = {
    reachable: true,
    calls,
    handlers,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!server.reachable) throw new TypeError("Failed to fetch");
      const url = new URL(String(input), "http://gassi.test");
      const route = `${init?.method ?? "GET"} ${url.pathname}`;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ route, body, headers: (init?.headers ?? {}) as Record<string, string> });
      const handler = handlers[route];
      const answer = handler ? handler(body, url) : status(404, { error: "Gibt es nicht." });
      const { status: code, body: json } = isAnswer(answer) ? answer : { status: 200, body: answer };
      return new Response(JSON.stringify(json), { status: code, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  };
  return server;
}

const hirsch = { id: "p-hirsch", name: "Hirsch" };

/** A household as the API shows it to Hirsch's phone: Toffee, no walk running, commands applied as they come. */
export function household() {
  return fakeServer({
    "GET /api/me": () => ({ person: hirsch, device: { id: 1, kind: "web", name: "iPhone (Web)" }, household: { oidc: false, mail: false } }),
    "GET /api/people": () => ({ people: [hirsch, { id: "p-herzii", name: "Herzii" }] }),
    "GET /api/dogs": () => ({ dogs: [{ id: 1, name: "Toffee", color: "#b8691a", archived: false }] }),
    "GET /api/exercises": () => ({ exercises: [{ id: 1, name: "Sitz" }] }),
    "GET /api/treat-kinds": () => ({ treatKinds: [] }),
    "GET /api/sessions": () => ({ walk: null, training: null }),
    "POST /api/commands": (body) => ({ applied: (body as { commands: { id: string }[] }).commands.map((c) => c.id), dropped: [], view: { walk: null, training: null } }),
  });
}

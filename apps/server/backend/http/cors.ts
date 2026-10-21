// CORS for /api/* in development, when the Expo dev server (another origin, CORS_ORIGIN) calls the API. In production
// the web app is served by this server (same origin) and CORS_ORIGIN is empty: nothing is allowed.
type Handler = (req: Request) => Promise<Response>;

const PREFLIGHT = { "access-control-allow-methods": "GET, POST, PATCH, DELETE", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "600" };

export function cors(origin: string | null, handler: Handler): Handler {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: origin ? { "access-control-allow-origin": origin, vary: "Origin", ...PREFLIGHT } : {} });
    const res = await handler(req);
    if (!origin) return res;
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "Origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

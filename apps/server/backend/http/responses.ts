// Small response helpers shared by the route handlers.

export function seeOther(location: string, headers: HeadersInit = {}): Response {
  const res = new Response(null, { status: 303, headers });
  res.headers.set("Location", location);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

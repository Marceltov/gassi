// Small response helpers shared by the route handlers.

export function seeOther(location: string, headers: HeadersInit = {}): Response {
  const res = new Response(null, { status: 303, headers });
  res.headers.set("Location", location);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Where to go after signing in: a same-origin path, else "/". A second "/" or any "\" would make it
 * protocol-relative (browsers read "\" as "/"), and browsers drop tabs and newlines, so "/\t/x" is "//x". */
export const safeNext = (v: unknown): string => (typeof v === "string" && /^\/(?![/\\])[^\\\x00-\x1f\x7f]*$/.test(v) ? v : "/");

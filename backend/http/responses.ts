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

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A plain German page for answers that aren't the app's pages (the 403 after signing in). */
export function htmlPage(status: number, title: string, text: string, link: { href: string; label: string }): Response {
  const body = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)} · Gassi</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:0 auto;padding:3rem 1.5rem;line-height:1.5}h1{font-size:1.5rem}a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:.75rem;background:#b5621e;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></body></html>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

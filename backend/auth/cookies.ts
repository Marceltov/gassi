// Reading a request's cookies and writing Set-Cookie headers. Every cookie here is HttpOnly and SameSite=Lax, and
// Secure when the app is served over https.

export function readCookie(headers: Headers, name: string): string | undefined {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

export type CookieOptions = { maxAge: number; path?: string; secure: boolean };

export function setCookie(name: string, value: string, { maxAge, path = "/", secure }: CookieOptions): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export const clearCookie = (name: string, options: Omit<CookieOptions, "maxAge">) => setCookie(name, "", { ...options, maxAge: 0 });

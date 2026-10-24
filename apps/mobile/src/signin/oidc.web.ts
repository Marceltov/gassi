// The web app's OIDC sign-in leaves the page and ends at /join?token=… (or /join?error=signin) on this server. Same
// interface as oidc.ts ("./oidc" means this file on the web, so that one is named with its extension).
import type * as Native from "./oidc.ts";

export async function startOidc(server: string): Promise<void> {
  const start = new URL("/api/oidc/start?web=1", server || window.location.origin);
  window.location.assign(start.href);
}

const sameAsNative: typeof Native = { startOidc };
void sameAsNative;

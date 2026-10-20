// Starts the stub OIDC issuer for the whole run; the returned function stops it.
import { startOidcStub } from "./oidc-stub";

export default async function globalSetup() {
  const server = await startOidcStub();
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}

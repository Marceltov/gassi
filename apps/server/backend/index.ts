// The backend's boundary: the only module app/ may import from backend/ (enforced in eslint.config.mjs). The route
// handlers are mounted as they are; the link page asks for its content here.
import { type Mailer, smtpMailer } from "./auth/mail";
import { config } from "./config";
import { database } from "./db/open";
import { apiRouter } from "./http/api";
import { cors } from "./http/cors";
import { healthRoute } from "./http/health";
import { type Landing, landing } from "./http/landing";
import { logged } from "./http/requestlog";
import { oidcCallbackRoute, oidcStartRoute } from "./oidc/routes";
import { linkCodeKey } from "./secret";

export { startup } from "./startup";

// One SMTP transport per process (it pools connections).
let cachedMailer: { url: string; mailer: Mailer } | null = null;
const mailer = (smtp: { url: string; from: string }): Mailer => (cachedMailer?.url === smtp.url ? cachedMailer : (cachedMailer = { url: smtp.url, mailer: smtpMailer(smtp) })).mailer;

/** Every endpoint of the API contract (packages/api-client), and their CORS preflight (OPTIONS). */
export const api = logged(async (req) => {
  const { publicUrl, oidc, smtp, timeZone, defaultDogName, secret, dataDir, corsOrigin } = config();
  return cors(corsOrigin, async (req) => apiRouter({ db: await database(), now: () => new Date(), publicUrl, codeKey: linkCodeKey(secret, dataDir), oidc: oidc !== null, mailer: smtp && mailer(smtp), timeZone, defaultDogName })(req))(req);
});
export const health = logged(() => healthRoute());
export const oidcStart = logged((req) => oidcStartRoute(req));
export const oidcCallback = logged((req) => oidcCallbackRoute(req));

/** The page behind a setup, invite or magic link (/l/<token>). */
export async function linkLanding(token: string): Promise<Landing> {
  const { publicUrl, secret, dataDir } = config();
  return landing(await database(), () => new Date(), publicUrl, linkCodeKey(secret, dataDir), token);
}

// The backend's boundary: the only module app/ may import from backend/ (enforced in eslint.config.mjs). The route
// handlers are mounted as they are; the link page asks for its content here.
import { type Mailer, smtpMailer } from "./auth/mail";
import { config } from "./config";
import { database } from "./db/open";
import { apiRouter } from "./http/api";
import { healthRoute } from "./http/health";
import { type Landing, landing } from "./http/landing";
import { logged } from "./http/requestlog";
import { oidcCallbackRoute, oidcStartRoute } from "./oidc/routes";

export { startup } from "./startup";

// One SMTP transport per process (it pools connections).
let cachedMailer: { url: string; mailer: Mailer } | null = null;
const mailer = (smtp: { url: string; from: string }): Mailer => (cachedMailer?.url === smtp.url ? cachedMailer : (cachedMailer = { url: smtp.url, mailer: smtpMailer(smtp) })).mailer;

/** Every endpoint of the API contract (packages/api-client). */
export const api = logged(async (req) => {
  const { publicUrl, oidc, smtp, timeZone, defaultDogName } = config();
  return apiRouter({ db: await database(), now: () => new Date(), publicUrl, oidc: oidc !== null, mailer: smtp && mailer(smtp), timeZone, defaultDogName })(req);
});
export const health = logged(() => healthRoute());
export const oidcStart = logged((req) => oidcStartRoute(req));
export const oidcCallback = logged((req) => oidcCallbackRoute(req));

/** The page behind a setup, invite or magic link (/l/<token>). */
export async function linkLanding(token: string): Promise<Landing> {
  return landing(await database(), () => new Date(), config().publicUrl, token);
}

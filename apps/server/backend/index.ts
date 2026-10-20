// The backend's boundary: the only module the frontend (app/, components/, proxy.ts) may import from backend/
// (enforced in eslint.config.mjs). Pages and actions call the use cases here; route handlers are mounted as they are.
import { config } from "./config";
import { database } from "./db/open";
import { type Mailer, smtpMailer } from "./auth/mail";
import { apiRouter } from "./http/api";
import { type Landing, landing } from "./http/landing";
import { commandsRoute } from "./http/commands";
import { exportRoute } from "./http/export";
import { healthRoute } from "./http/health";
import { logged } from "./http/requestlog";
import { logoutRoute, oidcCallbackRoute, oidcStartRoute } from "./oidc/routes";

export { config };
export { database };
export { startup } from "./startup";
export { SESSION_COOKIE, sessionUser, type User } from "./auth/session";
export { safeNext } from "./http/responses";

export const health = logged(() => healthRoute());
export const oidcStart = logged((req) => oidcStartRoute(req));
export const oidcCallback = logged((req) => oidcCallbackRoute(req));
export const logout = logged(() => logoutRoute());
export const exportCsv = logged((req) => exportRoute(req));
export const commands = logged((req) => commandsRoute(req));
// One SMTP transport per process (it pools connections).
let cachedMailer: { url: string; mailer: Mailer } | null = null;
const mailer = (smtp: { url: string; from: string }): Mailer => (cachedMailer?.url === smtp.url ? cachedMailer : (cachedMailer = { url: smtp.url, mailer: smtpMailer(smtp) })).mailer;

export const api = logged(async (req) => {
  const { publicUrl, oidc, smtp } = config();
  return apiRouter({ db: await database(), now: () => new Date(), publicUrl, oidc: oidc !== null, mailer: smtp && mailer(smtp) })(req);
});

// The use cases (backend/diary.ts) and what they hand out.
export { diary, HISTORY_PAGE, InputError, type EntryView, type HistoryFilter, type HistoryPage, type TodayView } from "./diary";

// The household's exercises and treat kinds.
export { catalog, type Exercise, type TreatKind } from "./catalog";

// Walks and trainings while they run (the walk and training screens send their taps to `commands`).
export { sessions, type SessionsView, type TrainingView, type WalkView, type WalkSummary } from "./sessions";
export type { Stock } from "@gassi/domain";
export { type WeekView, type WeekDay, addDays } from "@gassi/domain";

/** The page behind a setup, invite or magic link (/l/<token>). */
export async function linkLanding(token: string): Promise<Landing> {
  return landing(await database(), () => new Date(), config().publicUrl, token);
}

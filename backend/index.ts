// The backend's boundary: the only module the frontend (app/, components/, proxy.ts) may import from backend/
// (enforced in eslint.config.mjs). Pages and actions call the use cases here; route handlers are mounted as they are.
import { apiEntriesRoute } from "./http/api";
import { commandsRoute } from "./http/commands";
import { exportRoute } from "./http/export";
import { healthRoute } from "./http/health";
import { logged } from "./http/requestlog";
import { logoutRoute, oidcCallbackRoute, oidcStartRoute } from "./oidc/routes";

export { config } from "./config";
export { database } from "./db/open";
export { startup } from "./startup";
export { SESSION_COOKIE, sessionUser, type User } from "./auth/session";
export { safeNext } from "./http/responses";

export const health = logged(() => healthRoute());
export const oidcStart = logged((req) => oidcStartRoute(req));
export const oidcCallback = logged((req) => oidcCallbackRoute(req));
export const logout = logged(() => logoutRoute());
export const exportCsv = logged((req) => exportRoute(req));
export const apiEntries = logged((req) => apiEntriesRoute(req));
export const commands = logged((req) => commandsRoute(req));

// The use cases (backend/diary.ts) and what they hand out.
export { diary, HISTORY_PAGE, InputError, type EntryView, type HistoryFilter, type HistoryPage, type TodayView } from "./diary";

// The household's exercises and treat kinds.
export { catalog, type Exercise, type TreatKind } from "./catalog";

// Walks and trainings while they run (the walk and training screens send their taps to `commands`).
export { sessions, type SessionsView, type TrainingView, type WalkView, type WalkSummary } from "./sessions";
export { type Stock } from "./stock";

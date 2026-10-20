// The backend's boundary: the only module the frontend (app/, components/, proxy.ts) may import from backend/
// (enforced in eslint.config.mjs). Pages and actions call the use cases here; route handlers are mounted as they are.
import { healthRoute } from "./http/health";
import { logged } from "./http/requestlog";

export { config } from "./config";
export { database } from "./db/open";

export const health = logged(() => healthRoute());

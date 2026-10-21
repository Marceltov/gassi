import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The boundaries, one block per part of the monorepo:
// - packages/domain is pure: no Node, no React or Next, no database, nothing from the apps;
// - packages/api-client builds on the domain and zod only;
// - in apps/server the frontend (app/) reaches the backend only through @/backend (backend/index.ts), and backend/ is
//   framework-free.
const APPS = ["@gassi/server", "@gassi/server/*", "**/apps/*"];
const DOMAIN_IMPORTS = {
  paths: ["react", "react-dom", "next", "kysely", "better-sqlite3", "pino", "@gassi/api-client"].map((name) => ({ name, message: "packages/domain is pure and shared: no frameworks, no database." })),
  patterns: [
    { group: ["node:*"], message: "packages/domain runs on phones and watches too: no Node APIs." },
    { group: ["react/*", "react-dom/*", "next/*", "kysely/*"], message: "packages/domain is pure and shared: no frameworks, no database." },
    { group: APPS, message: "packages/domain never imports an app." },
  ],
};
const API_CLIENT_IMPORTS = {
  paths: ["react", "next", "kysely", "better-sqlite3", "pino"].map((name) => ({ name, message: "packages/api-client uses only the domain and zod." })),
  patterns: [
    { group: ["node:*"], message: "packages/api-client runs on phones too: no Node APIs." },
    { group: APPS, message: "packages/api-client never imports an app." },
  ],
};
const FRONTEND_IMPORTS = {
  patterns: [{ group: ["@/backend/*", "**/backend/*"], message: "The frontend imports the backend only through @/backend (backend/index.ts)." }],
};
const BACKEND_IMPORTS = {
  paths: ["next", "react", "react-dom"].map((name) => ({ name, message: "backend/ is framework-free." })),
  patterns: [
    { group: ["next/*", "react/*", "react-dom/*"], message: "backend/ is framework-free." },
    { group: ["@/app/*", "**/app/*"], message: "backend/ never imports the frontend." },
    { group: ["@/backend", "@/backend/*"], message: "Inside backend/, use relative imports." },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "apps/server" } } },
  { files: ["packages/domain/**"], rules: { "no-restricted-imports": ["error", DOMAIN_IMPORTS] } },
  { files: ["packages/api-client/**"], rules: { "no-restricted-imports": ["error", API_CLIENT_IMPORTS] } },
  { files: ["apps/server/app/**"], ignores: ["**/*.test.ts"], rules: { "no-restricted-imports": ["error", FRONTEND_IMPORTS] } },
  { files: ["apps/server/backend/**"], rules: { "no-restricted-imports": ["error", BACKEND_IMPORTS] } },
  globalIgnores(["**/.next/**", "**/node_modules/**", "**/next-env.d.ts", "**/test-results/**", "**/playwright-report/**", "**/data/**"]),
]);

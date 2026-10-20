import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The boundaries: the frontend reaches the backend only through @/backend (backend/index.ts); backend/ is
// framework-free; shared/ runs in the browser too.
const FRONTEND_IMPORTS = {
  patterns: [{ group: ["@/backend/*", "**/backend/*"], message: "The frontend imports the backend only through @/backend (backend/index.ts)." }],
};
const BACKEND_IMPORTS = {
  paths: ["next", "react", "react-dom"].map((name) => ({ name, message: "backend/ is framework-free." })),
  patterns: [
    { group: ["next/*", "react/*", "react-dom/*"], message: "backend/ is framework-free." },
    { group: ["@/app/*", "@/components/*", "@/proxy", "**/app/*", "**/components/*"], message: "backend/ never imports the frontend." },
    { group: ["@/backend", "@/backend/*"], message: "Inside backend/, use relative imports." },
  ],
};
const SHARED_IMPORTS = {
  patterns: [{ group: ["node:*", "@/backend", "@/backend/*", "@/app/*", "@/components/*", "**/backend/*"], message: "shared/ runs in the browser too." }],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["app/**", "components/**", "proxy.ts"], ignores: ["**/*.test.ts"], rules: { "no-restricted-imports": ["error", FRONTEND_IMPORTS] } },
  { files: ["backend/**"], rules: { "no-restricted-imports": ["error", BACKEND_IMPORTS] } },
  { files: ["shared/**"], rules: { "no-restricted-imports": ["error", SHARED_IMPORTS] } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "test-results/**", "playwright-report/**"]),
]);

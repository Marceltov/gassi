import { defineConfig } from "vitest/config";

// One run over every workspace; each project keeps its own config.
export default defineConfig({
  test: { projects: ["packages/*", "apps/server", "apps/mobile", { test: { name: "tooling", include: ["tooling/**/*.test.ts"] } }] },
});

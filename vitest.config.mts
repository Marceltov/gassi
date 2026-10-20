import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests that check log lines capture them with logTo(); the rest print nothing.
export default defineConfig({
  test: { environment: "node", exclude: ["**/node_modules/**", ".next/**", "e2e/**"], env: { LOG_LEVEL: "silent" } },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The app's plain modules (src/**, no React Native) in Node, resolved like the web export: device.web.ts before
// device.ts. vitest.setup.ts gives each test an empty localStorage. The workspace's base tsconfig, because Vite can't
// follow this app's `extends: "expo/tsconfig.base"` (not in expo's package exports).
export default defineConfig({
  tsconfig: "../../tsconfig.base.json",
  test: { name: "mobile", environment: "node", include: ["src/**/*.test.ts"], setupFiles: ["./vitest.setup.ts"] },
  resolve: {
    extensions: [".web.ts", ".web.tsx", ".ts", ".tsx", ".mjs", ".js", ".json"],
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});

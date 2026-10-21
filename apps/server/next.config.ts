import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The workspace packages are TypeScript source; the standalone output is traced from the repo root so they come along.
  transpilePackages: ["@gassi/domain", "@gassi/api-client"],
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // pino and better-sqlite3 (a native module) stay plain Node requires, so the standalone build traces them into node_modules.
  serverExternalPackages: ["pino", "better-sqlite3"],
  // Gassi doesn't use next/image: leave sharp (only for scripts/icons.mjs) out of the standalone output.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
};

export default nextConfig;

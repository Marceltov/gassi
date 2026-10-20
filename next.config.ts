import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pino and better-sqlite3 (a native module) stay plain Node requires, so the standalone build traces them into node_modules.
  serverExternalPackages: ["pino", "better-sqlite3"],
  // Gassi doesn't use next/image: leave sharp (only for scripts/icons.mjs) out of the standalone output.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
};

export default nextConfig;

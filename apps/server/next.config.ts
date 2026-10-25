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
  // The Expo web app (apps/mobile, copied into public/ by scripts/web.mjs) is a single page: every path nothing else
  // answers gets its index.html. The fallback phase comes after public files, app routes and dynamic routes, so /api,
  // /l/<token>, /health and the OIDC routes win. A missing build file (under _next/, _expo/ or assets/, or with a dot
  // in its last segment, e.g. an old hashed chunk a stale tab asks for) stays a 404 rather than HTML.
  // Hashed build files (the web app's and the Android update's bundles and assets) change their name with their
  // content: kept for good (#107).
  headers: async () => ["/_expo/static/:path*", "/assets/:path*"].map((source) => ({ source, headers: [{ key: "cache-control", value: "public, max-age=31536000, immutable" }] })),
  rewrites: async () => ({ beforeFiles: [], afterFiles: [], fallback: [{ source: "/:path((?!_next/|_expo/|assets/)(?!.*\\.[^/]*$).*)", destination: "/index.html" }] }),
};

export default nextConfig;

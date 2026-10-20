# Build: full deps, next build (standalone output). Debian like the runtime image, so the build sees the same libc.
FROM node:22-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No install scripts: better-sqlite3 ships prebuilt binaries (x64 and arm64) and loads them; nothing else needs a script.
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && mkdir /data

# Runtime: only the standalone server and its traced deps. Distroless: Node and its libraries, no shell or npm.
FROM gcr.io/distroless/nodejs22-debian13
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/data PORT=3000 HOSTNAME=0.0.0.0 TZ=Europe/Berlin
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
COPY --from=build --chown=1000:1000 /data /data
COPY docker-entrypoint.mjs ./
VOLUME /data
EXPOSE 3000
# GET /health answers 503 when the database doesn't.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Starts as root only to switch to the owner of /data (see docker-entrypoint.mjs).
ENTRYPOINT ["/nodejs/bin/node", "docker-entrypoint.mjs"]

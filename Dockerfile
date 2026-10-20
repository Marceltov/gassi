# Build: full deps, next build (standalone output). Debian like the runtime image, so the build sees the same libc.
FROM node:22-trixie-slim AS build
WORKDIR /app
# The workspace manifests first, so the install layer is cached while only code changes.
COPY package.json package-lock.json .npmrc ./
COPY packages/domain/package.json packages/domain/
COPY packages/api-client/package.json packages/api-client/
COPY apps/server/package.json apps/server/
# No install scripts (.npmrc): better-sqlite3 ships prebuilt binaries (x64 and arm64) and loads them.
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @gassi/server && mkdir /data

# Runtime: only the standalone server and its traced deps. Distroless: Node and its libraries, no shell or npm.
FROM gcr.io/distroless/nodejs22-debian13
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/data PORT=3000 HOSTNAME=0.0.0.0 TZ=Europe/Berlin
# The standalone output is traced from the repo root: the server sits in apps/server, the dependencies next to it.
COPY --from=build --chown=1000:1000 /app/apps/server/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/apps/server/.next/static ./apps/server/.next/static
COPY --from=build --chown=1000:1000 /app/apps/server/public ./apps/server/public
COPY --from=build --chown=1000:1000 /data /data
COPY apps/server/docker-entrypoint.mjs ./
VOLUME /data
EXPOSE 3000
# GET /health answers 503 when the database doesn't.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Starts as root only to switch to the owner of /data (see docker-entrypoint.mjs).
ENTRYPOINT ["/nodejs/bin/node", "docker-entrypoint.mjs"]

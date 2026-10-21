# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Gassi is a self-hosted dog diary (walks with GPS tracks, training, food and stock, weight) being rebuilt as phone
apps, a Garmin app and a self-hostable server. Step 1 (foundation: monorepo, API, sign-in by links, dogs, tracks) is
built; the app, the Garmin app and the dashboard follow (`docs/PLAN.md`). Versions stay 0.x until there is real data.
`docs/BUILD.md` holds the implementation decisions, `docs/adr/` the architecture decisions.

## Commands (from the repo root)

- `npm test` (Vitest over all workspaces); one test: `npx vitest run <path> -t <name>`
- `npm run test:e2e` (builds the server, then Playwright: the API through the typed client, the link page in Chromium)
- `npm run typecheck`, `npm run lint`
- `npm run dev -w @gassi/server` (needs `apps/server/.env.local`, see `apps/server/.env.example`)
- `scripts/quiet.sh <command>` prints only failures and the summary of a long run
- Installs run without scripts (`.npmrc`): better-sqlite3 loads its prebuilt binary.

## Code layout

- `packages/domain` (`@gassi/domain`): pure TypeScript shared by server, app and dashboard — entry types and schemas,
  dog rules, commands and the offline projection and queue, stock, week, track metrics, time helpers. No Node, React,
  Next or database (lint-enforced, `tooling/boundaries.test.ts`).
- `packages/api-client` (`@gassi/api-client`): the API contract (one table of endpoints with zod in/out) and the typed
  client built from it. The server's router validates against the same table (ADR 0003).
- `apps/server` (`@gassi/server`): Next.js. `backend/` is framework-free and reached from `app/` only through
  `backend/index.ts`. `backend/http/router.ts` serves the contract from one catch-all route (`app/api/[...path]`);
  `backend/http/api.ts` maps each endpoint to a use case (`diary.ts`, `sessions.ts`, `tracks.ts`, `catalog.ts`,
  `dogs.ts`, `auth/*`). Devices sign in with Bearer tokens from one-time links (ADR 0004).
- Tests sit next to the code. Outside calls are injected (`fetch`, `now`, the database), not mocked:
  `backend/db/testing.ts` is a fresh database per test (seeded with Toffee, Hirsch, Herzii unless `{ empty: true }`),
  `backend/http/testing.ts` calls the API with device tokens, `backend/oidc/testing.ts` is a stub issuer.

## Repo layout

This is its own git repo, checked out at `/root/services/gassi-dev`, a sibling folder the homelab `services` repo
gitignores. `/root/services/gassi/` belongs to the `services` repo and only holds the deployment (compose file,
`.env`, `./data`). The parent `/root/services/CLAUDE.md` describes homelab conventions (gethomepage network,
labels, ports); they apply to that deployment folder, not to the app code here.

## Decisions to respect

- **Rebuild plan:** `docs/PLAN.md` (apps, Garmin, dashboard, self-hosting) in five steps; each step gets its own design
  and plan. Nobody depends on 0.2; no compatibility layers.
- **One model:** an `Entry` for one or more dogs (`dogIds`; pee/poop/weight exactly one, restock/stockcheck/note none),
  with optional `endedAt`/`amountG`/`foodKind`/`note`. Walkers, pauses, exercises, treats and GPS tracks are child rows.
  "During a walk" is decided by time (ADR 0002). Taps are idempotent commands with client ids (ADR 0001).
- **No redundancy:** domain rules exist once in `packages/domain`; the API exists once in the contract.
- **Sign-in:** setup link (printed at first start), invite links, magic links (SMTP), optional OIDC; devices hold
  tokens stored only as hashes (ADR 0004). Only `PUBLIC_URL` is required.
- **UI (apps, dashboard):** German, phone-first, native look and feel in the apps, dark mode.
- **Deployment:** one container (`Dockerfile`, standalone server at `apps/server/server.js`); GitHub Actions pushes
  `ghcr.io/marceltov/gassi`; Watchtower pulls `:main` in the homelab.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

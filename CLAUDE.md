# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Gassi is a self-hosted dog diary (walks with GPS tracks, training, food and stock, weight) being rebuilt as a web
app, an Android app, a Garmin app and a self-hostable server. Step 1 (foundation: monorepo, API, sign-in by links,
dogs, tracks) and step 2 (the app: one Expo app, shipped for the web first, ADR 0006) are built; the Android build of
the same app and the Garmin app follow (`docs/PLAN.md`, ADR 0005). Versions stay 0.x until there is real data.
`docs/adr/` holds the decisions (ADR 0007 the offline web app, 0008 the web app in the server's image);
`docs/BUILD.md` is the history of steps 1 and 2a.

## Commands (from the repo root)

- `npm test` (Vitest over all workspaces); one test: `npx vitest run <path> -t <name>`
- `npm run build` (the app export, then the server's build); `npm run build:app` alone exports the Expo app into
  `apps/server/public` and skips the export when nothing it depends on changed (`--force` exports anyway)
- `npm run test:e2e` only once, at the end of a branch before its PR (Marcel); while iterating, run the unit tests and
  at most the one spec that covers the change (`npx playwright test e2e/<spec>` in `apps/server` after `npm run build`)
- `npm run test:e2e` (run it from the root: the workspace's own script tests whatever export is already in `public/`; it does the app step, the server's build, then Playwright: the API through the typed client, the link
  page and the app's screens (`apps/server/e2e/app-*.spec.ts`) in Chromium)
- `npm run typecheck`, `npm run lint`
- `npm run dev -w @gassi/server` (needs `apps/server/.env.local`, see `apps/server/.env.example`)
- The app in dev: `npm run web -w @gassi/mobile` (port 8081) against that server, with `CORS_ORIGIN=http://localhost:8081`
  in the server's `.env.local` and `EXPO_PUBLIC_API_URL=http://localhost:3000` in `apps/mobile/.env.local` (see
  `apps/mobile/.env.example`). Development needs no export.
- `scripts/quiet.sh <command>` prints only failures and the summary of a long run
- Installs run without scripts (`.npmrc`): better-sqlite3 loads its prebuilt binary.

## Code layout

- `packages/domain` (`@gassi/domain`): pure TypeScript shared by server, web app and Android app — entry types and
  schemas, dog rules, commands and the offline projection and queue, stock, week, track metrics, time helpers. No
  Node, React, Next or database (lint-enforced, `tooling/boundaries.test.ts`).
- `packages/api-client` (`@gassi/api-client`): the API contract (one table of endpoints with zod in/out) and the typed
  client built from it. The server's router validates against the same table (ADR 0003).
- `apps/server` (`@gassi/server`): Next.js. `backend/` is framework-free and reached from `app/` only through
  `backend/index.ts`. `backend/http/router.ts` serves the contract from one catch-all route (`app/api/[...path]`);
  `backend/http/api.ts` maps each endpoint to a use case (`diary.ts`, `sessions.ts`, `tracks.ts`, `catalog.ts`,
  `dogs.ts`, `auth/*`). Devices sign in with Bearer tokens from one-time links (ADR 0004).
- `apps/mobile` (`@gassi/mobile`): the Expo Router app for the web now and Android in step 3 (ADR 0006). Screens in
  `app/` stay thin and render from `src/` (start, walk, food, training, history, week, more). `src/data` holds the
  device, the command queue and the household snapshot behind modules with a `.web.ts` file (localStorage); other
  platform parts the same way (`.web.tsx`: maps, pickers, sheet). `src/track` records the walk's route on the phone
  that records it (ADR 0014): positions (`geo.web.ts`), batches kept and sent (`recorder.ts`), the wake lock. No domain rules here; writes other than taps need the
  server and say `OFFLINE`. `public/` holds the web page template, manifest and service worker. Its e2e tests run
  against the server's build in `apps/server/e2e` (`app-*.spec.ts`).
- Tests sit next to the code. Outside calls are injected (`fetch`, `now`, the database), not mocked:
  `backend/db/testing.ts` is a fresh database per test (seeded with Toffee, Hirsch, Herzii unless `{ empty: true }`),
  `backend/http/testing.ts` calls the API with device tokens, `backend/oidc/testing.ts` is a stub issuer.

## Repo layout

This is its own git repo, checked out at `/root/services/gassi-dev`, a sibling folder the homelab `services` repo
gitignores. `/root/services/gassi/` belongs to the `services` repo and only holds the deployment (compose file,
`.env`, `./data`). The parent `/root/services/CLAUDE.md` describes homelab conventions (gethomepage network,
labels, ports); they apply to that deployment folder, not to the app code here.

## Decisions to respect

**Read `docs/GUIDELINES.md` before writing, naming or reviewing code**, and whenever a question of naming, language,
compatibility, tests or shipping comes up. It holds the working rules (English code and German UI, no compatibility
layers or redirects, where code goes, tests, shipping). When Marcel makes a new ruling, add it there in the same PR.

- **Rebuild plan:** `docs/PLAN.md` in five steps (foundation, web app, Android app, Garmin app, release); each step
  gets its own design and plan. No iOS app from us (ADR 0005). Nobody depends on 0.2; no compatibility layers.
- **One model:** an `Entry` for one or more dogs (`dogIds`; pee/mark/poop/weight/encounters exactly one,
  restock/stockcheck/opened/note none), with optional `endedAt`/`amountG`/`foodKind`/`note`, and `details` (JSON) for
  what only some kinds have (ADR 0013). Walkers, pauses, exercises, treats and GPS tracks are child rows. "During a
  walk" is decided by time (ADR 0002). Taps are idempotent commands with client ids (ADR 0001). A feeding names no can;
  an opened can is its own entry and Vorrat counts closed cans (ADR 0011).
- **No redundancy:** domain rules exist once in `packages/domain`; the API exists once in the contract.
- **Sign-in:** setup link (printed at first start), invite links, magic links (SMTP), each also as a typed code,
  optional OIDC; devices hold tokens stored only as hashes (ADR 0004). Only `PUBLIC_URL` is required.
- **UI (web app, Android app):** German, phone-first, dark mode; the web app is an installable PWA, the Android app
  has native look and feel.
- **Deployment:** one container (`Dockerfile`, standalone server at `apps/server/server.js`); GitHub Actions pushes
  `ghcr.io/marceltov/gassi`; Watchtower pulls `:main` in the homelab.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

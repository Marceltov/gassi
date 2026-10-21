---
status: accepted
date: 2026-10-21
decision-makers: Marcel Bruckner
---

# The web app is served from the server's image

## Context and Problem Statement

ADR 0006 chose one Expo app for the web and Android, served by the server. How does its web export get into the
server's single container, and how does the build stay quick while developing?

## Decision Drivers

* One container per household, API and web app on one origin.
* The server's own files in `public/` (the icons, tracked in git) must never be overwritten by a generated one.
* A server-only change should not wait a minute for an Expo export.
* `.npmrc` runs no install scripts, so npm pre-scripts do not run either.

## Considered Options

* A second container (or a CDN) for the web app
* Export the app into the server's `public/` at build time, with a Next fallback for app paths
* Export on every server build, or only when the app changed

## Decision Outcome

Chosen option: "export into `public/`, and only when the app changed".

- **The export is copied** into `apps/server/public` by `scripts/web.mjs`. It never overwrites a tracked file (a clash
  is an error) and removes what the last copy put there, listed in `public/.web-export`.
- **A fallback rewrite** in `next.config.ts` answers app paths with the export's `index.html`. `/api`, `/l/`,
  `/health`, `_next/`, `_expo/`, `assets/` and any path with a file extension stay as they are, so a missing bundle is
  a 404, not the app's HTML (a stale tab asking for an old chunk).
- **One container.** The Dockerfile runs `npm run build:app` and the server's build explicitly, and always exports
  afresh; the image has no stale cache.
- **The export is skipped when nothing changed.** `npm run build:app` hashes `apps/mobile/{app,src,public,assets}`, the
  files directly in `apps/mobile`, `packages/domain/src`, `packages/api-client/src`, their `package.json` files, the lockfile, `node_modules/.package-lock.json` (what is installed) and the
  `EXPO_PUBLIC_*` variables, and compares the result with the stamp kept in `apps/mobile/dist/.stamp`. It prints "App
  unverändert, Export übersprungen" or "App exportiert"; `--force` exports anyway. The copy always runs. The server's
  `build` is `next build` only; the root `build` and `test:e2e` run the app step first. Development needs no export
  (the Expo dev server on 8081 and `npm run dev -w @gassi/server`).
- **One React for the workspace,** 19.3: Expo SDK 58 pins it, and Next 16 accepts any React 19. The root `workspaces`
  list is explicit (`packages/*`, `apps/mobile`, `apps/server`), so an app folder that is not an npm package (the
  Garmin app, step 4) stays out.
- **CORS only for development:** with `CORS_ORIGIN` (the Expo dev server) `/api/*` answers carry it; in production it
  is empty and the app is same-origin. Any `OPTIONS /api/*` answers 204.

### Consequences

* Good, because the image is one container and the web app and the API share an origin.
* Good, because a server-only change builds in seconds and a second `test:e2e` skips the export.
* Bad, because the skip trusts the list of inputs: an install that differs from what npm recorded in `node_modules/.package-lock.json` goes unnoticed (`--force` exports anyway).
* Bad, because `public/` holds generated files next to tracked ones, kept apart by the manifest and the clash check.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Gassi is a self-hosted dog diary for one household (walks, food, pee, poop). It is in **planning**: no code,
build, lint or test commands exist yet. `docs/PLAN.md` is the source of truth for scope, data model, stack,
auth and tests; `docs/BUILD.md` fixes the implementation decisions and phases for the one-shot v1 build; `docs/ALTERNATIVES.md` records why existing tools were rejected. Update this file with real
commands once phase 1 (scaffold) lands.

## Repo layout

This is its own git repo, checked out at `/root/services/gassi-dev`, a sibling folder the homelab `services` repo
gitignores. `/root/services/gassi/` belongs to the `services` repo and only holds the deployment (compose file,
`.env`, `./data`). The parent `/root/services/CLAUDE.md` describes homelab conventions (gethomepage network,
labels, ports); they apply to that deployment folder, not to the app code here.

## Decisions to respect (from docs/PLAN.md)

- **One model for everything:** an `Entry` (`dogId`, `type`, `at`, optional `durationMin`/`amount`/`note`,
  `loggedBy`). New kinds of events are new `type` values, not new tables. Pee/poop during a walk are separate
  entries sharing a timestamp, not nested.
- **Auth is a real OIDC client of authentik**, modelled on `notefeed/notefeed` (`backend/oidc/`): code flow +
  PKCE, state/nonce in a short-lived signed cookie, id_token claims checked, signed session cookie with expiry.
  No auth library, no forward-auth header. Users come from `USERS=marcel:Hirsch,bille:Herzii` (keyed by
  `preferred_username`); anyone else gets 403, never a new account.
- **Stack and tests follow `notefeed/notefeed`** (not Healthy): Next.js App Router + server actions, TypeScript,
  Kysely on better-sqlite3, Tailwind, pino, zod, PWA. Vitest for units with injected `fetch`/`now` instead of
  mocks; Playwright against `next start` with phone projects and a stub OIDC issuer; an image smoke test in CI.
  Details in PLAN.md "Tests". A separate API/SPA and Postgres were explicitly rejected for v1.
- **UI:** German, phone-first, large touch targets, dark mode, Tabler Icons (`@tabler/icons-react`).
- **Scope:** v1 is the five-item list in PLAN.md. Items under "Later" and the non-goals (vet records, training,
  multi-household, GPS) stay out unless asked.
- **Deployment:** `Dockerfile` here; GitHub Actions pushes `ghcr.io/marceltov/gassi` (tags `main`, short sha,
  version tags). Watchtower in the homelab pulls updates. Expose a healthcheck endpoint.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

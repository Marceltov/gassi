# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Gassi is a self-hosted dog diary for one household (walks, food, pee, poop). It is in **planning**: no code,
build, lint or test commands exist yet. `docs/PLAN.md` is the source of truth for scope, data model, stack,
auth and tests; `docs/BUILD.md` fixes the implementation decisions and phases for the one-shot v1 build; `docs/ALTERNATIVES.md` records why existing tools were rejected. Update this file with real
commands once phase 1 (scaffold) lands.

## Repo layout

This is its own git repo, nested inside the homelab `services` repo at `/root/services/gassi`. The parent
`/root/services/CLAUDE.md` describes homelab conventions (gethomepage network, labels, ports); they apply to the
deployment compose file, not to the app code here.

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

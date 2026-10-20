# Plan

## Goal

Two people (Hirsch and Herzii) share one dog (Toffee). Either of them should be able to log what just happened
in one tap, and see at a glance what has happened today: when the dog was last out, last ate, last peed and
pooped, and who did it.

Non-goals: vet records, training plans, multi-household SaaS, GPS tracking. If we miss one of these later,
it's a later version, not the first one.

## The core idea

Everything is an **entry**: *who* did *what* with *which dog*, *when*, with an optional amount, duration and
note. Walks, meals, pee and poop are entry types. That keeps the data model and the UI to one list.

```
Entry
  id
  dogId
  type        walk | food | pee | poop | note   (more types later, no schema change needed)
  at          when it happened (editable, defaults to now)
  durationMin optional, for walks
  amount      optional, for food (grams)
  note        optional free text
  loggedBy    username from authentik
  createdAt / updatedAt

Dog
  id, name, (photo later)
```

A walk can carry pee/poop as separate entries at the same time. There's no nesting, just a shared timestamp.

## First version (v1)

1. **One-tap logging:** big buttons for 🚶 walk, 🍖 food, 💧 pee and 💩 poop. A tap logs "now, by me". A long
   press or a follow-up sheet adjusts time, duration, amount or note.
2. **Today screen:** time since the last walk, meal, pee and poop, and who did each.
3. **History:** a reverse-chronological log, filterable by type and person. Entries can be edited and deleted.
4. **Built for phones:** installable PWA ("Add to Home Screen"), German UI, large touch targets, dark mode.
5. **Data:** SQLite in a mounted volume, plus a CSV export.

## Later, only if we miss it

- Reminders through ntfy (for example, "no walk for 6 hours")
- Weekly overview and simple charts (walks per person, meals per day)
- Weight tracking
- Several dogs (the model already has `dogId`)
- Food stock ("bag runs out in about 5 days")

## Authentication

No user management in the app. Caddy runs authentik forward auth and passes `X-Authentik-Username`, and the app
trusts that header. Known users and their display names come from config, for example
`USERS=marcel:Hirsch,bille:Herzii`. An unknown username gets a 403, not a new account.

Accepted risk (same as Housetrained today): anyone who reaches the container port directly on the LAN can send
the header themselves. Optional hardening: only accept the header from a configured proxy IP
(`TRUSTED_PROXY=192.168.178.160`).

The REST API (if any) uses a static bearer token from env, and its path is excluded in authentik.

## Stack

Modelled on notefeed (`notefeed/notefeed`), so it's built the way we already build things:

- **Next.js** (App Router, `output: "standalone"`), React 19, TypeScript, Node 22
- **SQLite** through **better-sqlite3** and **Kysely**: a typed query builder with code migrations, and no
  generated client or ORM. Prisma isn't needed.
- **zod** for request validation, **pino** for logging
- **Tailwind 4** and **lucide-react** icons
- `app/manifest.ts` for the PWA
- Tests: **Vitest** (unit, next to the code as `*.test.ts`), **Playwright** e2e for the "log a walk" flow.
  Broad runs go through `scripts/quiet.sh`, as in notefeed.

Considered and rejected for v1: Prisma (codegen and an engine for one table), a separate API and SPA (twice the
moving parts), Postgres (one household doesn't need it).

## Architecture (notefeed's conventions)

- `app/` holds the UI and routes only. All server logic lives in `backend/` behind one boundary module
  (`backend/index.ts`), and code used by both lives in `shared/` (notefeed ADR 0003).
- **One write path:** every POST is a backend route handler, and the UI uses plain forms that work without
  JavaScript (notefeed ADR 0005). No server actions.
- `backend/db.ts`: the Kysely instance and migrations, run at startup. `backend/config.ts`: the only place that
  reads environment variables (`DATA_DIR`, `USERS`, `TRUSTED_PROXY`, `API_TOKEN`).
- `GET /health` returns 503 when the DB isn't usable. It's used by the Docker healthcheck.
- Repo docs as in notefeed: `CLAUDE.md` and `AGENTS.md` (commands, rules), `CONTEXT.md` (domain words:
  entry, dog, walker...), ADRs in `docs/adr/`.

## Deployment

- `Dockerfile` as in notefeed: build on `node:22-trixie-slim` (`npm ci --ignore-scripts`, since better-sqlite3
  ships prebuilt binaries), run on **distroless** `nodejs22` with only the standalone output, `/data` as the
  volume, a healthcheck through `node -e fetch(/health)`, and an entrypoint that switches to the owner of `/data`.
- GitHub Actions: lint, typecheck, unit and e2e tests, an image smoke test, then build and push
  `ghcr.io/marceltov/gassi` (amd64 and arm64) on every push to `main` (tags: `main`, the short sha) and on
  `vX.Y.Z` tags. The package has to be set to public once, or the homelab needs a pull token.
- `services` repo: new `gassi/docker-compose.yaml` following the homelab conventions (gethomepage network,
  homepage, kuma and dynacat labels, healthcheck, `./data` volume gitignored). Watchtower updates it.
- Hostname: reuse `housetrained.herziis.de` (DNS, Caddy route and authentik provider already exist) or move to
  `gassi.herziis.de`. Decide at cut-over.
- Cut-over: Housetrained keeps running until Gassi v1 works, then the hostname is switched over. No data
  migration, since Housetrained holds no real history yet.

## Milestones

1. Skeleton: Next.js, Kysely and SQLite with the first migration, `backend/` boundary, Dockerfile (distroless),
   CI with image build, header auth, `/health`
2. Logging and Today screen
3. History with edit and delete, CSV export
4. PWA polish, German texts, dark mode
5. Deploy to the homelab, switch the hostname, retire Housetrained

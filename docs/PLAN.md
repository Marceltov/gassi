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
6. **API and MCP from day one:** everything the UI does is also a REST endpoint (OpenAPI) and an MCP tool, signed in through authentik. See [Three first-class interfaces](#three-first-class-interfaces).

## Later, only if we miss it

- Reminders through ntfy (for example, "no walk for 6 hours")
- Weekly overview and simple charts (walks per person, meals per day)
- Weight tracking
- Several dogs (the model already has `dogId`)
- Food stock ("bag runs out in about 5 days")

## Three first-class interfaces

The web UI, the REST API and MCP are equals: each can do everything (log, list, edit, delete, today's status),
and all three go through the same backend functions. A rule (validation, who may edit what) exists once, in
`backend/`.

### Authentication: OIDC with authentik

As in notefeed's identity mode (notefeed ADR 0014), but always on:

- **Sign-in:** authorization code flow with PKCE against authentik, using generic OIDC discovery. Config:
  `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and an allow-list `OIDC_ALLOW` (usernames, or an
  authentik group via the `groups` claim).
- **No accounts or passwords in the app.** Identity comes from the id_token on each sign-in: `sub` as the stable
  id, `preferred_username` and `name` for display. A small `users` table caches `sub → display name` so the
  history can show names. Removing someone from the allow-list (or authentik) locks them out.
- **Session:** a signed, HttpOnly session cookie (HMAC with `SECRET_KEY`), with no server-side session store.
- **No trusted headers.** Unlike the Housetrained setup, nothing trusts `X-Authentik-*`, so the LAN spoofing
  risk is gone. Caddy needs no `forward_auth` for Gassi, just a plain `reverse_proxy`.

### REST API

Code-first, as in notefeed ADR 0006:

- **One route table** (`backend/http/api.ts`). Each entry declares method, path, zod schemas for params, query
  and body, and typed responses. A dispatcher behind `app/api/v1/[...path]` routes, validates and maps domain
  errors to `{error, code}`.
- **OpenAPI 3.1** is generated from the table (`z.toJSONSchema`), served at `/api/v1/openapi.json`, committed as
  `openapi.json` (CI fails when stale) and rendered in the docs.
- **The web UI uses the same routes** (one write path, notefeed ADR 0005): forms post to the API handlers.
- **Auth:** the session cookie (browser), an OAuth access token (see below), or a **personal API token** for
  scripts and Home Assistant. Personal tokens are created and revoked on a settings page, stored hashed, and
  act as their owner.
- **Endpoints (v1):** `GET /dogs`, `GET/POST /entries` (filter by dog, type, person, time range),
  `GET/PATCH/DELETE /entries/{id}`, `GET /today` (last walk, meal, pee and poop per dog, with who), `GET /me`.

### MCP

As in notefeed ADR 0007:

- **Endpoint:** `/mcp`, built on `@modelcontextprotocol/server` (pinned exactly) and mounted as a Next.js route.
  It uses the current MCP protocol version only.
- **Tools:** `log_entry`, `list_entries`, `get_entry`, `update_entry`, `delete_entry`, `today`, `list_dogs`.
  They call the same backend functions as the API. Known failures become `isError` results with the API's
  message, and nothing internal leaks. Examples: "Toffee just pooped", or "when was the last walk and who did
  it?"
- **OAuth for MCP clients (Claude.ai connector, Claude Code):** Gassi is its own minimal authorization server
  (RFC 8414 and RFC 9728 metadata, PKCE S256, public clients, dynamic client registration), because MCP clients
  expect DCR and authentik doesn't provide it. The **login step is authentik**: the authorize page shows
  "Sign in with authentik", runs the same OIDC flow, then issues a code for that user.
- **Stateless tokens**, as in notefeed: client ids, codes, access tokens (1 h) and refresh tokens (30 days,
  rotated) are HMAC-signed with a key derived from `SECRET_KEY`. Rotating the key revokes everything. Tokens are
  bound to the resource `<PUBLIC_URL>/mcp`, and an `Origin` that isn't the public host gets a 403.
- `/mcp` without a valid token gets a 401 with `WWW-Authenticate` pointing at the protected-resource
  metadata, so clients find the login on their own.

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
  reads environment variables (`DATA_DIR`, `PUBLIC_URL`, `SECRET_KEY`, `OIDC_*`).
- `backend/http/` holds the route table and dispatcher, `backend/oidc/` the authentik sign-in, `backend/oauth/`
  the MCP authorization server, and `backend/mcp.ts` the MCP tools.
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
- Hostname: reuse `housetrained.herziis.de` (DNS and Caddy route already exist) or move to
  `gassi.herziis.de`. Decide at cut-over.
- Cut-over: Housetrained keeps running until Gassi v1 works, then the hostname is switched over. No data
  migration, since Housetrained holds no real history yet.

## Milestones

1. Skeleton: Next.js, Kysely and SQLite with the first migration, `backend/` boundary, Dockerfile (distroless),
   CI with image build, `/health`, docs site
2. Sign-in with authentik (OIDC), session cookie, allow-list
3. API: route table, dispatcher, OpenAPI generation; entries, dogs and today endpoints; personal API tokens
4. Web UI on top of the API: one-tap logging, Today screen, history with edit and delete, CSV export
5. MCP: `/mcp` tools, OAuth authorization server with DCR and an authentik login step
6. PWA polish, German texts, dark mode
7. Deploy to the homelab, switch the hostname, retire Housetrained

## authentik changes at cut-over

- New **OAuth2/OpenID provider** (confidential client) for Gassi, with redirect URI
  `<PUBLIC_URL>/api/oidc/callback` and scopes `openid profile email` (plus `groups` if the allow-list uses a
  group). Bind it to an application restricted to Hirsch and Herzii.
- If Gassi takes over `housetrained.herziis.de`, remove the Housetrained **proxy provider** and the Caddy
  `forward_auth` block. Gassi does its own login, and Caddy only reverse-proxies.

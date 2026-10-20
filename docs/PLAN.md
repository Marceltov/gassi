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

1. **One-tap logging:** big buttons with icons for walk, food, pee and poop. A tap logs "now, by me". A long
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

Gassi is its own OIDC client of authentik (an OAuth2/OpenID provider and application named `gassi`), built like
notefeed's sign-in (`notefeed/notefeed`, `backend/oidc/`) without an auth library:

- Authorization code flow with PKCE (S256), `state` and `nonce`, scope `openid profile email`. Endpoints come from
  the issuer's discovery document.
- No server-side session store: the sign-in in flight (state, nonce, verifier, where to go next) rides in a
  short-lived signed cookie that only `/api/oidc/*` receives.
- The callback exchanges the code and checks the id_token's `iss`, `aud`/`azp`, `exp` and `nonce`. Its signature
  is not verified, since it comes straight from the token endpoint over TLS (OIDC Core 3.1.3.7).
- Success sets a signed, HttpOnly `SameSite=Lax` session cookie (HMAC with `SECRET`) naming the user, with an
  expiry (notefeed's has none). Logout clears it.
- No user management in the app: authentik decides who gets in (the `gassi` application's bindings). Whoever it
  signs in is a user, keyed by the `preferred_username` claim and shown by the `name` claim (else the username);
  each sign-in records that name so entries and filters can show it.

Config: `PUBLIC_URL`, `SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. The redirect URI
is `${PUBLIC_URL}/api/oidc/callback`. Caddy only reverse-proxies; no forward auth.

The REST API (if any) uses a static bearer token from env.

## Stack

Modelled on notefeed (`notefeed/notefeed`), which already runs the same kind of app here:

- **Next.js** (App Router) with server actions, TypeScript, Node 22
- **Kysely** on **better-sqlite3** (SQLite in the mounted volume), migrations in code
- **Tailwind** for styling
- **Tabler Icons** (`@tabler/icons-react`) for buttons and entry types (has walk, bone, droplet, poo, dog)
- **pino** for logs, **zod** for config and input validation
- PWA manifest and service worker

Considered and rejected for v1: a separate API and SPA (twice the moving parts), Postgres (one household doesn't
need it).

## Tests

The same layers as notefeed:

- **Vitest** (`environment: "node"`, `@` alias, logs silenced) for libraries, route handlers and server actions.
  Test files sit next to the code (`flow.ts` + `flow.test.ts`). Outside calls are injected rather than mocked:
  OIDC functions take a `fetch` and a `now`, and tests pass a stub issuer that serves discovery and a token
  endpoint with a hand-built id_token. Database tests run on a fresh SQLite file in a temp `DATA_DIR`.
- **Playwright** in `e2e/` against the production build (`next build` then `next start`, never `next dev`), each
  server on its own port with its own `DATA_DIR` under `test-results/`. Phone projects (iPhone 13 on WebKit,
  Pixel 7 on Chromium), since Gassi is used on phones. A stub OIDC issuer started in `globalSetup` signs the test
  users in.
- **Image smoke test** in CI: build the image, start it on a mounted folder, wait for the healthcheck to report
  healthy, check that the database file belongs to the folder's owner.
- **CI** (`.github/workflows/ci.yml`): `check` (lint, typecheck, `npm test`), `e2e`, `image-smoke`; the `image`
  job pushes only after `check` and `image-smoke` pass.

Scripts: `npm test` (`vitest run`), `npm run test:e2e` (`next build && playwright test`), `npm run typecheck`,
`npm run lint`.

## Deployment

- `Dockerfile` in this repo. GitHub Actions builds and pushes `ghcr.io/marceltov/gassi` on every push to `main`
  (tags: `main`, the short sha) and on version tags.
- `services` repo: new `gassi/docker-compose.yaml` following the homelab conventions (gethomepage network,
  homepage, kuma and dynacat labels, healthcheck, `./data` volume gitignored). Watchtower updates it.
- Hostname: reuse `housetrained.herziis.de` (DNS and Caddy route already exist; the
  forward-auth provider is replaced by the new OIDC provider) or move to
  `gassi.herziis.de`. Decide at cut-over.
- Cut-over: Housetrained keeps running until Gassi v1 works, then the hostname is switched over. No data
  migration, since Housetrained holds no real history yet.

## Build

v1 is built in one autonomous run; see [BUILD.md](BUILD.md) for the goal statement, the fixed implementation
decisions, the phases and their checks, and the manual steps after the build (authentik, compose, hostname).

# Build: Gassi v1 in one shot

How v1 gets built in a single autonomous run, from an empty repo to a green pull request. `PLAN.md` says *what*
and *why*. This file fixes every *how* decision, so the run never has to stop and ask. Where the two disagree,
PLAN.md wins and this file gets fixed.

Reference implementation for anything not spelled out here: `notefeed/notefeed` (same stack, same OIDC sign-in,
same test layers). Copy its patterns, not its features.

## Goal statement

> Build Gassi v1 as described in `docs/PLAN.md` and `docs/BUILD.md`, in one run, on the branch `v1`. Done means
> every phase's checks below pass locally, the work is committed phase by phase, the branch is pushed, a pull
> request is open against `main`, and its CI run is green. Do not merge it, and don't touch the homelab: no
> authentik, Caddy, DNS or `services` repo changes. When something isn't decided here, take the simplest option
> that matches notefeed, write the decision under "Decisions made during the build" at the end of this file, and
> keep going.

## Fixed decisions

### Runtime and layout

- Node 22 (`.nvmrc`), npm, Next.js 16 App Router with `output: "standalone"`, React 19, TypeScript strict.
  Versions as in notefeed's `package.json`.
- `proxy.ts` (Next 16's middleware) sends signed-out page requests to `/login?next=<path>`. Route handlers check
  the session themselves.
- Layout: `app/` (pages, route handlers), `backend/` (config, db, auth, entries, csv; no React), `components/`
  (client components), `e2e/` (Playwright), `scripts/` (icons, quiet runner). Tests sit next to the code.
- Config is read from env through one zod-validated module (`backend/config.ts`). Missing required config fails
  at startup with the variable's name. `.env.example` documents every variable.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `PUBLIC_URL` | yes | | e.g. `https://gassi.herziis.de`, used for the redirect URI and cookie `Secure` |
| `SECRET` | yes | | at least 32 chars, HMAC key for cookies |
| `OIDC_ISSUER` | yes | | e.g. `https://auth.herziis.de/application/o/gassi/` |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | yes | | from the authentik provider |
| `DOG_NAME` | no | `Toffee` | name of the dog created on first start |
| `DATA_DIR` | no | `./data` (`/data` in the image) | holds `gassi.db` |
| `TZ` | no | `Europe/Berlin` | what "today" and displayed times mean |
| `API_TOKEN` | no | | when set, enables the bearer-token REST API |
| `LOG_LEVEL` | no | `info` | pino level |

### Data

- Kysely on better-sqlite3, file `${DATA_DIR}/gassi.db`, WAL mode. Migrations are in code (Kysely `Migrator`,
  like notefeed `backend/storage/sql/migrations.ts`) and run on startup, before the first request.
- `dog`: `id` integer pk, `name` text, `created_at`.
- `entry`: `id` integer pk, `dog_id` → dog, `type` text (`walk|food|pee|poop|note`, checked in code, not a DB
  enum), `at` text (ISO 8601 UTC), `duration_min` int null, `amount_g` int null, `note` text null, `logged_by`
  text (username), `created_at`, `updated_at`. Index on `(dog_id, at desc)`.
- On startup, if no dog exists, create one named `DOG_NAME`. v1 always uses the first dog.
- All times are stored in UTC and shown in `TZ`. "Today" is the calendar day in `TZ`.

### Sign-in

Port of notefeed `backend/oidc/` reduced to a single provider:

- `GET /api/oidc/start?next=` → discovery (cached for 1 h) → redirect to authorize with code + PKCE S256, `state`,
  `nonce`, scope `openid profile email`. The flight (state, nonce, verifier, next) goes in the signed cookie
  `gassi_oidc` (path `/api/oidc`, 10 min).
- `GET /api/oidc/callback` → check state against the flight, exchange the code, check the id_token's `iss`,
  `aud`/`azp`, `exp` and `nonce` (signature not verified, see PLAN.md), take `preferred_username` and `name`.
  On success it sets `gassi_session` (signed `{username, exp}`, 30 days, HttpOnly, SameSite=Lax, Secure when
  `PUBLIC_URL` is https) and redirects to a same-origin `next` only. Who may sign in is decided in authentik.
- `POST /logout` clears the session and redirects to `/login`.
- `/login` is a page with one button "Anmelden" that starts the flow.
- Failures log the reason, never the person's address or tokens.

### Screens (German, phone-first, dark mode by `prefers-color-scheme`)

- **Heute (`/`)**: four big tiles in a 2×2 grid with Tabler icons, `IconWalk` Gassi, `IconBone` Futter,
  `IconDroplet` Pipi, `IconPoo` Poopoo. Each shows how long ago it last happened ("vor 2 Std. 5 Min.", "heute noch
  nicht") and who did it. A tap logs "now, by me" through a server action, shows a toast "Gassi eingetragen"
  with "Rückgängig" for 5 s, and refreshes the tiles. Each tile has a small "…" button that opens a sheet with
  time (default now), duration (walk), amount in grams (food), and note. Below the tiles: today's entries.
- **Verlauf (`/verlauf`)**: reverse-chronological list grouped by day, filter chips by type and by person, 50
  per page with "Mehr laden". Tapping an entry opens the same sheet to edit it or delete it (with a
  confirmation).
- **Export**: `GET /export.csv` (signed in) downloads every entry as CSV: `;`-separated, UTF-8 with BOM, times in
  `TZ`, German headers.
- Bottom navigation: Heute, Verlauf, with Abmelden in a menu. Touch targets are at least 48 px.
- Everyone signed in can edit and delete every entry; it's one household.

### PWA

- `app/manifest.ts`: name "Gassi", `display: standalone`, theme colors for light and dark, icons 192, 512 and a
  512 maskable PNG, generated from `public/icon.svg` by `scripts/icons.mjs` (sharp, dev dependency) and
  committed.
- `public/sw.js`, hand-written, no library: cache-first for `/_next/static/*` and the icons, network-first for
  pages with an offline fallback page "Keine Verbindung". Registered from the root layout in production only.

### API (only when `API_TOKEN` is set)

- `GET /api/v1/entries?type=&since=` and `POST /api/v1/entries` with `Authorization: Bearer <API_TOKEN>`, JSON
  validated with zod, `loggedBy` given in the body and checked against the people who have signed in. Without `API_TOKEN` these answer
  404.

### Operations

- `GET /health`: 200 `{"status":"ok"}` when `select 1` succeeds, 503 otherwise. No auth.
- pino JSON logs, one line per request from the route handlers, no secrets or cookies.
- Dockerfile like notefeed's: `node:22-trixie-slim` build with `npm ci --ignore-scripts`, distroless
  `nodejs22-debian13` runtime, standalone output, `/data` volume, `HEALTHCHECK` on `/health`, and
  `docker-entrypoint.mjs` that switches from root to the owner of `/data` (as notefeed does).

## Tests

As in PLAN.md "Tests". Concretely:

- **Unit (Vitest)**: config parsing (missing and invalid vars), cookie sign/verify/expiry/tamper, OIDC discover,
  authorize URL and exchange against a stub issuer passed as `fetch` (every id_token check has a failing case),
  callback handling (state mismatch, unknown user, open redirect in `next`), entry repository on a temp
  `DATA_DIR` (create, list today in `TZ` across midnight UTC, edit, delete, last-per-type), "vor …" formatting,
  CSV (escaping, BOM, separator), API auth (404 without token, 401 bad token).
- **e2e (Playwright)** against `next start` on port 3100 with its own `DATA_DIR`. `e2e/oidc-stub.ts`, started in
  `globalSetup`, is a minimal issuer (discovery, authorize that redirects straight back with a code for the user
  named in a query param or cookie, token endpoint returning an unsigned id_token). Projects: desktop Chromium,
  `iPhone 13` (WebKit), `Pixel 7` (Chromium). Specs:
  - `auth.spec.ts`: signed out goes to `/login`, sign in as marcel, see "Hirsch", log out; someone new signs in
    under the name authentik gives.
  - `today.spec.ts`: tap Gassi, the tile says "gerade eben · Hirsch", undo removes it; log food with 200 g
    through the sheet.
  - `history.spec.ts`: entries by both users, filter by person, edit a time, delete.
  - `export.spec.ts`: the CSV download has a header and the entries.
  - `pwa.spec.ts`: the manifest is served and the service worker registers.
  - `health.spec.ts`: `/health` is 200 without a session.
- **Image smoke (CI)**: build, run on a fresh `./data` with dummy OIDC env, wait for `healthy`, check `gassi.db`
  is owned by the runner's uid.
- `scripts/quiet.sh` as in notefeed. `CLAUDE.md` gets the commands: `npm run dev`, `npm test`,
  `npx vitest run <path> -t <name>`, `npm run test:e2e`, `npx playwright test -g <name>`, `npm run typecheck`,
  `npm run lint`.

## CI (`.github/workflows/ci.yml`)

Jobs `check` (lint, typecheck, unit), `e2e` (installs Chromium and WebKit, uploads the report), `image-smoke`,
and `image` (needs `check` and `image-smoke`; on `main` pushes and `v*` tags). `image` pushes
`ghcr.io/marceltov/gassi` with tags `main`, `sha-<short>`, semver on tags and `latest`, for linux/amd64 and
arm64. Actions versions as in notefeed.

## Phases

Each phase ends with its checks passing and a commit. Don't start the next phase on red.

1. **Scaffold**: Next.js, TypeScript, Tailwind, ESLint, Vitest, Playwright configs, `scripts/quiet.sh`,
   `.nvmrc`, `.env.example`, `.gitignore` (`data/`, `test-results/`, `playwright-report/`), config module.
   Check: `npm run lint`, `npm run typecheck`, `npm test` pass; `npm run dev` serves a page.
2. **Data**: Kysely, migrations, dog seed, entry repository, `/health`. Check: unit tests for the repository and
   health pass.
3. **Sign-in**: cookies, OIDC flow, `proxy.ts`, login, logout, OIDC stub, `auth.spec.ts`. Check: unit
   tests and `auth.spec.ts` pass in all three projects.
4. **Today**: tiles, quick log, undo, detail sheet, today list. Check: `today.spec.ts` green on the phones.
5. **History and export**: list, filters, paging, edit, delete, CSV, API. Check: `history.spec.ts`,
   `export.spec.ts` and the API unit tests pass.
6. **PWA and polish**: manifest, icons, service worker, offline page, dark mode, German copy pass. Check:
   `pwa.spec.ts` passes; screenshots of Heute and Verlauf on iPhone 13 in light and dark look right.
7. **Ship**: Dockerfile, entrypoint, CI workflow, README (run locally, configure, deploy), CLAUDE.md commands.
   Check: `docker build` works and the container turns healthy locally; push `v1`, open the PR, CI green.

## After the build (by hand, not part of the run)

1. Review and merge the PR. CI pushes `ghcr.io/marceltov/gassi:main`.
2. authentik: create an OAuth2/OpenID provider and application `gassi` (confidential client, redirect URI
   `https://<host>/api/oidc/callback`, scopes openid, profile, email), and bind it to Hirsch and Herzii.
3. `services` repo: add `gassi/docker-compose.yaml` (port `10038`, gethomepage network, homepage, kuma and
   dynacat labels, `./data` volume gitignored, `.env` with the variables above). Watchtower stays on. The app checkout lives in the
   gitignored sibling `gassi-dev/`, so it doesn't collide.
4. Caddy: plain reverse proxy for the host, without forward auth.
5. Switch the hostname over and retire Housetrained.

## Decisions made during the build

- **Poopoo, not Kacka:** the poop tile and every label for that type say "Poopoo" (asked for during the build).
- **Today tiles show today only:** a tile shows the latest entry of its type on today's calendar day in `TZ`, else
  "heute noch nicht". An entry from 23:30 yesterday doesn't count as today's.
- **One e2e server, run serially:** all specs share the server on port 3100 and one fresh `DATA_DIR`, with
  `workers: 1`, so the tiles and lists are predictable; specs identify their entries by notes, not by counts alone.
- **e2e stub picks the user by cookie:** the stub issuer signs in whoever the `stub_user` cookie on its own origin
  names, so a spec chooses the user without a login form.
- **Layers:** `backend/entries/repository.ts` (SQL) → `backend/diary.ts` (use cases: the one dog, `TZ`, display
  names, input validation with German messages) → `app/actions.ts` (server actions: session check, revalidate) and
  the route handlers. The frontend imports the backend only through `backend/index.ts` (lint rule, as in notefeed).
- **`shared/`** holds browser-safe code used on both sides: entry types and labels, time zone helpers (Intl only,
  no date library), the action result type.
- **Times in the sheet:** the `datetime-local` value is wall time in `TZ` (passed to the client), converted to UTC
  in the browser; the server only accepts ISO instants.
- **Delete confirmation** is a second button in the sheet ("Wirklich löschen"), not `window.confirm`.
- **Look:** gravel-sage background with a colour per entry type (walk green, food ochre, pee mustard, poop brown,
  note slate) used for tile, list dot and filter chip; Atkinson Hyperlegible Next as the only typeface (legible in
  sunlight); the time since the last entry is the largest text on a tile.
- **History paging** uses offset/limit (51 rows fetched to know whether there is more). Pages loaded with "Mehr
  laden" stay in the browser and are patched on edit/delete; the first page is refreshed by the server action.
- **Filters are links** (`/verlauf?type=walk&by=bille`); unknown values are ignored, not an error.
- **CSV:** oldest first, date and time in separate columns (`Datum;Uhrzeit;Art;Dauer (Min.);Menge (g);Notiz;Von`),
  CRLF lines, file name `gassi-<today>.csv`. The proxy sends a signed-out browser to the login page; the route
  itself answers 401 without a session.
- **API:** `API_TOKEN` must be at least 16 characters; `POST` defaults `at` to now and answers 201 with the entry;
  `since` is inclusive.
- **Proxy:** only GET/HEAD page requests are redirected; server actions and route handlers check the session
  themselves.
- **Startup:** `instrumentation.ts` checks the config and opens the database; on failure it prints the reason
  (every missing variable by name) and exits 1, so the container stops instead of answering errors.
- **Service worker** caches successful page loads for the offline fallback and never touches server actions, the
  API, the export or the sign-in routes.
- **CI** runs on pull requests and on pushes to `main` and `v*` tags (not on every branch push, so a PR runs once);
  `image` also tags `sha-<short>`.
- **`npm run oidc-stub`** runs the e2e stub issuer for local development without authentik.
- **Image:** `TZ=Europe/Berlin` is set as the image default; `public/` is copied next to the standalone server.
- **authentik decides who gets in (changed at deployment, on request):** there is no `USERS` allow-list and no 403
  page. Whoever authentik signs in is a user; the display name is the id_token's `name` (else the username), kept
  in the session cookie and recorded in a `person` table at each sign-in, so entries, the CSV and the person filter
  show names. The API's `loggedBy` must be someone who has signed in. Set display names (e.g. "Hirsch") in authentik.

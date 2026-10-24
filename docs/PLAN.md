# Plan

## From 0.3: a web app, an Android app, a Garmin app and a server anyone can run

Gassi becomes something a household uses on the phone for everything around its dogs, so easily that it really logs
everything, and something other households can run themselves (agreed with Marcel on 2026-10-20, platforms revised
on 2026-10-21, ADR 0005).

- **Web app** (installable PWA, phone-first): logging, including walks (start/stop, pauses, several walkers,
  pee/poop during the walk, and the route while the app is open, ADR 0014), food and stock, training, weight; today,
  history, week, statistics and maps; also the dashboard on a big screen. Taps queue on the device without reception.
- **Android app** (the same Expo app, ADR 0006) with native look and feel: everything for daily use, plus the walk's GPS
  track recorded in the background. Built with EAS during development. An iOS app is left to the community.
- **Garmin app** (Connect IQ, Forerunner 165 first): start/stop, pee, poop, training and treats from the wrist; the
  watch records the track and saves the walk as a Garmin activity (from there Komoot and Apple Health). It gets its
  access through the web app.
- **Self-hostable:** one container per household, only `PUBLIC_URL` required; sign-in by setup link, invite links,
  magic links by e-mail (with SMTP) or the household's OIDC provider; open source (AGPL-3.0) when released.
- **Several dogs** per household; walks, trainings and feedings for one or more, pee/poop and weight for one.
- **Monorepo, no redundancy:** `packages/domain` holds the rules once, `packages/api-client` the API once.

Order, each with its own design and plan: 1 foundation (done: monorepo, API with device tokens and links, dogs,
tracks) · 2 the web app (done: one Expo app in `apps/mobile`, exported for the web, ADRs 0006 to 0008) · 3 the Android app · 4 the Garmin app · 5 release (open source, APK on GitHub, self-hosting
guide, the update path for other households, optional Play Store). Non-goals for now: a hosted service, several
households per server, reminders, training plans, vet records, an iOS app built by us. Versions stay 0.x until real data of others exists; nobody depends on 0.2, so no compatibility layers.

### Step 3 checklist (Android, from the step 2 reviews)

Struck through: done in #106 (Android 3a-1).

- ~~`data/signin.ts` redeems as `deviceKind: "web"`: the Android app is a `phone`.~~
- ~~`app/anmelden.tsx`'s "Mit authentik anmelden" uses `window.location.assign`: native needs the browser and the
  `gassi://join` return (`/api/oidc/start?app=1`).~~
- ~~`newId` needs `crypto.getRandomValues` (Hermes: a polyfill such as expo-crypto).~~
- `weekLabel` and the other `de-DE` date texts need ICU with German on Hermes.
- ~~The native `TimeField` commits only on end editing.~~
- ~~`data/kept.ts`, the queue and the device keep only in memory on native: real storage (the food facts, the
  snapshot and the ended walk included).~~
- Android icons and the adaptive icon.
- Native stand-ins to replace: `ui/Sheet.tsx`, ~~`more/Curve.tsx`, `map/TrackMap.tsx`, `ui/copy.ts`~~.

## Before the rebuild (0.1 and 0.2, replaced)

The web app below served one household with one dog. Its ideas carry over (everything is an entry; taps as commands,
ADR 0001; "during a walk" by time, ADR 0002); its screens are gone since 0.3.

### Goal

Two people (Hirsch and Herzii) share one dog (Toffee). Either of them should be able to log what just happened
in one tap, and see at a glance what has happened today: when the dog was last out, last ate, last peed and
pooped, and who did it.

Non-goals: vet records, training plans, multi-household SaaS, GPS tracking, several dogs, reminders. If we miss one
of these later, it's a later version.

### The core idea

Everything is an **entry**: *who* did *what* with *which dog*, *when*, with an optional end, amount and note.
Walks, trainings, meals, pee, poop, weight, restocks and stock counts are entry types. That keeps the data model and
the UI to one list.

```
Entry
  id
  dogId
  type        walk | food | pee | poop | note | training | weight | restock | stockcheck
  at          when it happened / started (editable, defaults to now)
  endedAt     optional; walks and trainings (null while one runs); the duration is derived
  amount      optional grams: food, restock, stockcheck, weight
  foodKind    optional: wet | dry (food, restock, stockcheck)
  unitG       optional: grams per can on wet restocks
  clientKey   the key a walk or training was started with (from the phone)
  note        optional free text
  loggedBy    username from authentik
  createdAt / updatedAt

  hanging off a walk: walkers (several people), pauses (start/end)
  hanging off a training: exercises practised (tags, not timed), treats given (count per treat kind)

Dog
  id, name, (photo later)
```

Pee/poop during a walk are separate entries. "During a walk" is decided by time (an entry whose `at` lies between
the walk's start and end), not by links (ADR 0002).

### First version (0.1)

1. **One-tap logging:** big buttons with icons for walk, food, pee and poop. A tap logs "now, by me". A long
   press or a follow-up sheet adjusts time, duration, amount or note.
2. **Today screen:** time since the last walk, meal, pee and poop, and who did each.
3. **History:** a reverse-chronological log, filterable by type and person. Entries can be edited and deleted.
4. **Built for phones:** installable PWA ("Add to Home Screen"), German UI, large touch targets, dark mode.
5. **Data:** SQLite in a mounted volume, plus a CSV export.

### 0.2

1. **Walks with start and stop ("Runde"):** the Gassi tile starts a walk at the door; `/runde` has a running clock,
   Pipi, Poopoo, Pause/Weiter, Training and Zuhause (stop, then a summary with a note). Several people can walk
   ("Mitgehen"); a joint walk counts for each of them. The walk is in the database from its start; every tap is a
   command with a client id and its own time, queued on the phone without reception and applied once, in time
   order (ADR 0001).
2. **Training** on a walk or at home: a block with a clock, exercises tapped (a household list) and a "+1" per treat
   kind (a household list with grams per piece and whether it comes out of the dry food).
3. **Food** as wet or dry in grams, the last portion offered; **Vorrat:** restocks (cans × grams, or kg), what is
   left, "reicht noch etwa N Tage" from the last 14 days, corrections by hand.
4. **Woche:** sums per person, exercises, treats, a column per day, a 0–24 h strip per day; a day opens its Verlauf.
5. **Weight** in kg with a curve. **Daily backup** of `gassi.db` (14 kept).

### Later, only if we miss it

- Reminders as push notifications of the installed PWA, with rules editable in the app (no ntfy)
- Several dogs (the model already has `dogId`)

### Authentication

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

### Stack

Modelled on notefeed (`notefeed/notefeed`), which already runs the same kind of app here:

- **Next.js** (App Router) with server actions, TypeScript, Node 22
- **Kysely** on **better-sqlite3** (SQLite in the mounted volume), migrations in code
- **Tailwind** for styling
- **Tabler Icons** (`@tabler/icons-react`) for buttons and entry types (has walk, bone, droplet, poo, dog)
- **pino** for logs, **zod** for config and input validation
- PWA manifest and service worker

Considered and rejected for 0.1: a separate API and SPA (twice the moving parts), Postgres (one household doesn't
need it).

### Tests

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

### Deployment

- `Dockerfile` in this repo. GitHub Actions builds and pushes `ghcr.io/marceltov/gassi` on every push to `main`
  (tags: `main`, the short sha) and on version tags.
- `services` repo: new `gassi/docker-compose.yaml` following the homelab conventions (gethomepage network,
  homepage, kuma and dynacat labels, healthcheck, `./data` volume gitignored). Watchtower updates it.
- Hostname: `gassi.herziis.de` (new DNS record and Caddy route), port `10038`.
- Cut-over: Housetrained kept running until Gassi 0.1 worked. No data migration, since Housetrained held no real
  history.

### Build

0.1 was built in one run and is live since 2026-10-20 (it was first tagged `v1.0.0`; that tag was retired, and versions stay 0.x until there is real data to keep); see [BUILD.md](BUILD.md) for the goal statement, the fixed implementation
decisions, the phases and their checks, and the manual steps after the build (authentik, compose, hostname).

# Gassi

A small, self-hosted dog diary for one household: who walked the dog and when, what and how much the dog ate,
pee and poop. Built for two people on phones, signed in through authentik.

- **Heute:** four big tiles (Gassi, Futter, Pipi, Poopoo). A tap logs "now, by me" and can be undone for 5 seconds;
  the "…" on a tile adds time, duration, amount or a note. Each tile shows how long ago it last happened today and
  who did it, and today's entries follow as a timeline.
- **Verlauf:** every entry, newest first, by day, filterable by type and person; tap one to edit or delete it.
- **Export:** Menü → "Als CSV exportieren" downloads everything (`;`-separated, opens in Excel/LibreOffice).
- Installable on the home screen (PWA), German, dark mode follows the phone.

How it was planned: [docs/PLAN.md](docs/PLAN.md) (scope, model, stack), [docs/BUILD.md](docs/BUILD.md) (the v1 build
and the decisions made during it), [docs/ALTERNATIVES.md](docs/ALTERNATIVES.md) (why not an existing tool).

## Run locally

Node 22 (`.nvmrc`).

```bash
npm install
cp .env.example .env.local   # fill in SECRET and the OIDC_* values of a provider you can sign in with
npm run dev                  # http://localhost:3000
```

Signing in needs an OIDC provider whose redirect URI is `${PUBLIC_URL}/api/oidc/callback`. For a quick look without
authentik, run the e2e stub issuer (`npm run oidc-stub`) and set `OIDC_ISSUER=http://127.0.0.1:3199`,
`OIDC_CLIENT_ID=gassi` and any `OIDC_CLIENT_SECRET`; it signs in as `marcel` without asking.

## Configure

Every variable, with its default, is in [.env.example](.env.example). Required: `PUBLIC_URL`, `SECRET` (32+
characters), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `USERS` (`marcel:Hirsch,bille:Herzii`, keyed by
the `preferred_username` claim; anyone else gets a 403). Gassi refuses to start and names the variable when one is
missing or wrong.

Optional: `DOG_NAME` (`Toffee`, used when the database is created), `DATA_DIR` (`./data`, `/data` in the image),
`TZ` (`Europe/Berlin`: what "today" means), `API_TOKEN` (enables the REST API), `LOG_LEVEL` (`info`).

### REST API

Only while `API_TOKEN` is set; otherwise 404.

```bash
curl -H "Authorization: Bearer $API_TOKEN" "https://gassi.example/api/v1/entries?type=walk&since=2026-10-01T00:00:00Z"
curl -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"loggedBy":"marcel","type":"food","amountG":200}' https://gassi.example/api/v1/entries
```

Types: `walk`, `food`, `pee`, `poop`, `note`. Optional fields: `at` (ISO 8601, default now), `durationMin`, `amountG`,
`note`. `loggedBy` must be a username from `USERS`.

## Deploy

CI pushes `ghcr.io/marceltov/gassi` on every push to `main` (`:main`, `:sha-<short>`, `:latest`) and on `v*` tags
(semver tags), for amd64 and arm64.

```yaml
services:
  gassi:
    image: ghcr.io/marceltov/gassi:main
    restart: unless-stopped
    env_file: .env
    ports:
      - "10038:3000"
    volumes:
      - ./data:/data   # gassi.db is written as the owner of this folder (PUID/PGID override)
```

The image has a `HEALTHCHECK` on `GET /health` (200 `{"status":"ok"}` while the database answers). In authentik,
create an OAuth2/OpenID provider and application `gassi` (confidential client, redirect URI
`https://<host>/api/oidc/callback`, scopes openid, profile, email). The reverse proxy only proxies; there is no
forward auth. The remaining homelab steps are in [docs/BUILD.md](docs/BUILD.md#after-the-build-by-hand-not-part-of-the-run).

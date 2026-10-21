# Gassi

A self-hosted dog diary for a household: walks with their GPS track, pee and poop, training with exercises and
treats, wet and dry food with what is left in stock, weight, and the week at a glance. One server per household;
the people of the household use it from their phones (an installable web app, an Android app that records the
route, and a Garmin app; iOS is open to the community), and the web app doubles as a dashboard in the browser.

**Status:** being rebuilt (version 0.x). The server and its API are ready (step 1); the web app, the Android app and
the Garmin app come next ([docs/PLAN.md](docs/PLAN.md)).

## Run your own server

```yaml
services:
  gassi:
    image: ghcr.io/marceltov/gassi:main
    restart: unless-stopped
    environment:
      PUBLIC_URL: https://gassi.example.org   # the address phones reach the server at
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data   # gassi.db, backups and the key for signed cookies, written as the owner of this folder
```

Only `PUBLIC_URL` is required. On first start the log shows a setup link:

```
Gassi einrichten: https://gassi.example.org/l/…
```

Open it on your phone: it opens the Gassi app (or shows a QR code for it), you enter your name and your dog's, and
the server is set up. A new link is printed on each start until then. Everyone else joins through an invite link
you create in the app and send them; each phone, the watch or a script gets its own device, which you can sign out.
Each link's page (and a sign-in mail) also shows a short code: the web app installed on an iPhone's home screen
doesn't share Safari's storage, so there you type the code instead of opening the link.

Optional settings:

| Variable | What for |
|---|---|
| `SMTP_URL` (`smtp://user:pass@host:587` or `smtps://…`), `MAIL_FROM` | Sign-in links by e-mail ("magic links") for people who saved an address |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Sign-in in the app and the web app through your own identity provider (authentik, Keycloak, …): all three or none. Then there is no setup link; the first sign-in sets the household up, new people come in through the provider, invites only add devices |
| `DOG_NAME` | The first dog's name when setup doesn't ask (with OIDC: else "Mein Hund"; rename it in the app) |
| `TZ` (default `Europe/Berlin`) | The household's time zone: days, weeks |
| `DATA_DIR` (default `/data` in the image), `SECRET`, `LOG_LEVEL` | Where data lives; a fixed key for cookies and sign-in codes (else one is kept in `DATA_DIR`; changing it voids open codes); log detail |

Updating from Gassi 0.2 (the web app): its database can't be migrated. The server refuses to start on it and says
so; move `data/gassi.db`, `gassi.db-wal` and `gassi.db-shm` aside and start again to set up afresh.

Gassi writes a consistent copy of its database every day to `data/backups/` and keeps 14; copy that folder off the
machine if your backup doesn't cover it. The image has a health check on `GET /health`.

## API

Everything the apps do goes through a JSON API with device tokens (`Authorization: Bearer …`), described as one table
in [packages/api-client/src/contract.ts](packages/api-client/src/contract.ts), which also provides a typed client
for TypeScript. A script gets its token like any device: through an invite link (kind `device`), redeemed with
`POST /api/auth/redeem`.

## Develop

Node 22 (`.nvmrc`), npm workspaces: `packages/domain` (the rules, shared), `packages/api-client` (contract and client),
`apps/server` (Next.js server). From the repo root: `npm install`, `npm test`, `npm run test:e2e`, `npm run lint`,
`npm run typecheck`; `npm run dev -w @gassi/server` with `apps/server/.env.local` (see `.env.example` there).

How it is planned and built: [docs/PLAN.md](docs/PLAN.md), [docs/BUILD.md](docs/BUILD.md), [docs/adr/](docs/adr/).

---
status: accepted
date: 2026-10-20
decision-makers: Marcel Bruckner
---

# Devices sign in with tokens from one-time links

## Context and Problem Statement

0.2 signed people in through authentik into a cookie session. Gassi is now for phone apps, a watch and households
without an identity provider, and they must be able to set up their own server with nothing but its address.

## Decision Drivers

* Only `PUBLIC_URL` required to run a server; no mail server or identity provider needed.
* Apps and the watch need long-lived credentials that can be revoked one by one (a lost phone).
* Households that have an identity provider should be able to keep using it.

## Considered Options

* Username and password accounts
* Cookie sessions as in 0.2, extended to the apps
* One-time links (setup, invite, magic) that each create a device with its own bearer token

## Decision Outcome

Chosen option: "One-time links that create devices", because it needs no password handling and no mail server, works
the same for phones, the watch and scripts, and a device can be signed out alone.

- A fresh server prints a setup link (first person and dog). Members create invite links for a new person or another
  device; with SMTP, a magic link by e-mail; with OIDC, the provider signs people in and the app gets a one-time link.
  In OIDC mode only devices can be invited, so the provider decides who is in.
- Links are single use, expire (7 days, magic links 15 minutes) and can be revoked. A link opens a page on the
  household's own server with "In App öffnen" (`gassi://join?server=…&token=…`) and a QR code; nothing central.
- Redeeming creates a device with a random token; the server keeps only its SHA-256. Tokens don't expire; deleting
  the device signs it out with the next request.

### Consequences

* Good, because setting up and joining are a link away, with nothing to remember.
* Good, because a lost phone is signed out without touching the others.
* Bad, because whoever gets hold of an unused link before its owner can use it; links are short-lived and single use
  to keep that window small.
* Bad, because the setup link is printed (it holds a token), so the server's stdout must be treated as sensitive
  until setup is done.

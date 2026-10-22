---
status: accepted
date: 2026-10-22
decision-makers: Marcel Bruckner
---

# Wrong sign-in codes are throttled in memory, per client and overall

## Context and Problem Statement

A sign-in code (`XXXX-XXXX`, ADR 0004) has 40 bits and redeems its link like the link's token does.
`POST /api/auth/redeem` and `GET /api/auth/link` had no limit. With N open links, one guess hits with probability
N/2^40. That alone is slow, but a guessed setup link hands over the whole household. How should guessing be held back
before other households run Gassi (step 5)?

## Decision Drivers

* One container per household and no other service: no Redis, no reverse proxy we can count on.
* The two of us must not lock ourselves out by mistyping a code a few times.
* A link's token (opened from the link or QR code) can't be guessed and should never be held up.

## Considered Options

* No limit: rely on the 40 bits
* Leaky buckets in the server's memory, per client and one shared by everyone
* Counts in the database, or a limit in the reverse proxy

## Decision Outcome

Chosen option: "leaky buckets in memory" (`backend/auth/throttle.ts`). Only a code that names no usable link
(`WrongLink`) counts. A client may get 10 wrong in a row and then one a minute; everyone together 30, then one every
10 s. A request over a limit gets 429 with "Zu viele falsche Codes. Bitte in ein paar Minuten nochmal." before its code
is looked up, even if that code is right. Tokens aren't counted or held.

The client is the first `X-Forwarded-For` address, else `X-Real-IP`. A guesser can make those headers up and so get a
fresh per-client bucket, but the shared bucket still holds: about 8,600 guesses a day, years per expected hit.

### Consequences

* Good, because guessing is held to a crawl without a new service or table.
* Bad, because a restart empties the buckets (one more burst for a guesser), and someone guessing from many addresses can
  fill the shared bucket and keep code sign-in waiting for everyone for a while; links and their QR codes still work.

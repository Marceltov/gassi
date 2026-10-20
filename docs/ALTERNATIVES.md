# Existing tools we evaluated (October 2026)

What we need: shared logging of walks (who and when), food (what and how much), pee and poop, for two people,
self-hosted, with authentik sign-in.

## Housetrained

<https://github.com/viciousnemesis/housetrained>, BSD-2, Python/Django

- **Fits:** the closest functional match. It's built for dogs and has one-tap logging of walks, meals and
  potty breaks, households, walk schedules, and reminders. It supports reverse-proxy header auth.
- **Concerns:** a fork of Baby Buddy, about 5 weeks old, with 1 star and one maintainer. 83 of 85 fork commits
  are AI co-authored. It has largely replaced Baby Buddy with a new 10k-line `pets` app and a broad feature set.
  No release or published image exists, so it has to be built from source.
- **Status:** currently deployed at housetrained.herziis.de (pinned commit, authentik login) as a stopgap.

## Baby Buddy

<https://github.com/babybuddy/babybuddy>, BSD-2, Python/Django

- **Fits:** mature (v2.11.0, September 2026), many contributors, official LinuxServer image, reverse-proxy
  header auth, REST API. Feedings, diaper changes (wet or solid maps to pee or poop) and timers work for a dog.
- **Concerns:** baby wording everywhere ("child", "diaper change", "tummy time"). No households, no walks as a
  first-class concept.

## Apps built for pets (all small and new)

| Project | Stars | Age | Maintainers | Covers | Missing |
|---|---|---|---|---|---|
| [itsSivvis/pet-manager](https://github.com/itsSivvis/pet-manager) (MIT, JS) | 0 | 2 weeks | 3 | health records, meds, feeding plans, ntfy reminders, multi-user | walk and potty log |
| [Anghios/robipet](https://www.homedock.cloud/apps/robipet/) (PolyForm Noncommercial, TS) | 18 | 1 year | 1 | vaccinations, weight, documents | daily logging; license isn't open source |
| [dunctk/pethealth](https://github.com/dunctk/pethealth) (AGPL-3.0, Rust) | 0 | 3 months | 1 | health timeline, vet share links | feeding, walks; not Docker-first |
| [AlexDreamien/pet-care-tracker](https://github.com/AlexDreamien/pet-care-tracker) (MIT, TS) | 0 | 6 weeks | 1 | medical records, ICS reminders | daily logging |
| [Companion](https://github.com/Ilyassokhlal/companion-pet-health-tracker) | n/a | new | 1 | health records plus an AI assistant | daily logging; built around a hosted LLM |

All of these focus on **health records**, not daily life. Several are also largely AI-written.

## Repurposable general tools

- **Beaver Habits** (<https://github.com/daya0576/beaverhabits>): a habit tracker, "walked today: yes or no".
  No amounts, times or per-person attribution.
- **Home Assistant:** counters, input helpers and a dashboard. Workable, but clunky to edit or browse history.
- **Grocy:** chores with "done by", and food stock consumption. Two separate concepts, and heavy for this.

## Commercial (not self-hosted)

DogLog, Doggy Data, Paws, Dog Assistant, Doggy Time. They cover the use case but keep the data in their cloud.

## Conclusion

Nothing mature is built for pets and covers daily logging. Baby Buddy is mature but awkward, and Housetrained
fits but is risky. The need itself is small (one entry list plus a today view), so we build **Gassi**: a
deliberately small app on the stack we already know, with authentik doing all the auth.

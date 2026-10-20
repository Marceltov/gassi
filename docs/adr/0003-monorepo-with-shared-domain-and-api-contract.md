---
status: accepted
date: 2026-10-20
decision-makers: Marcel Bruckner
---

# A monorepo with a shared domain package and one API contract

## Context and Problem Statement

Gassi is being rebuilt as a server, a React Native app, a web dashboard and a Garmin app. The rules (which entries
take which dogs, the command rules for late taps, the offline projection, stock, week and track metrics) and the API
would otherwise be written several times, and Marcel named redundancy and poor structure as what would make the
rebuild a failure.

## Considered Options

* Separate repos per app, each with its own copy of types and rules
* One repo with npm workspaces: a pure `domain` package, an `api-client` package with the contract, and the apps
* Generating clients from an OpenAPI document written by hand

## Decision Outcome

Chosen option: "One repo with npm workspaces", because the rules and the API then exist exactly once and every app
compiles against them.

- `packages/domain` is pure TypeScript (lint forbids Node, React, Next and the database, tested in
  `tooling/boundaries.test.ts`), so it runs on the server, in React Native and in the dashboard.
- `packages/api-client` holds the API as one table of endpoints (method, path, auth, zod input and output) and a
  typed client built from it. The server's router validates requests and answers against the same table, and its
  implementation map has one key per endpoint, so an endpoint without an implementation does not compile.
- The Garmin app (Monkey C) can't share code; it stays thin and follows the same contract.

### Consequences

* Good, because a change to a rule or an endpoint shows up as a type error everywhere it matters.
* Good, because the API is documented by the code that enforces it.
* Bad, because the packages are consumed as TypeScript source, which every consumer's bundler must transpile
  (Next: `transpilePackages`; Expo's Metro does it natively).
* Bad, because entry inputs are typed by the contract but validated by the use cases (to keep German per-field
  messages), so for those endpoints the contract checks less than for the others.

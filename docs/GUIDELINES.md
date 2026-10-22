# Coding guidelines

How we work on Gassi: rulings that hold across the code. Architectural decisions with their reasons are in
`docs/adr/`; this file collects the shorter rules and points to the ADRs where one exists. A new ruling gets a line
here in the same PR that follows it.

## Language

- **English inside, German only in what people see.** Route paths, file and folder names, components, identifiers,
  test ids, comments, commits and docs are English. Texts on screen, read out to screen readers, in messages and
  mails are German. Today's German routes (`/verlauf`, `/mehr`, …) are renamed in #51; until then a new sub-route
  follows its parent.
- Numbers and dates are formatted for German (`"de-DE"`) in one place each (`packages/domain`, `apps/mobile/src/time.ts`),
  never by hand. More languages come with #51.

## No compatibility

- Only two people use Gassi, and it stays 0.x while there is no real data (tags `v0.N.0`). A renamed or removed route,
  endpoint or field is just deleted: no redirects, aliases or compatibility layers, even when an issue asks for one.
- Schema changes may be folded into one migration while nothing real is stored; the PR says so.

## Where code goes

- A domain rule exists once, in `packages/domain` (no Node, React, Next or database there). The API exists once, in
  the contract in `packages/api-client` (ADR 0003).
- `apps/server/backend` is framework-free and reached from `app/` only through `backend/index.ts`.
- Screens in `apps/mobile/app` stay thin and render from `src/`. Platform differences sit behind a `.web.ts(x)` file
  next to the shared one (ADR 0006).
- Taps are idempotent commands with client ids (ADR 0001); "during a walk" is decided by time (ADR 0002).

## Tests

- Tests sit next to the code. Outside calls (`fetch`, `now`, the database) are injected, not mocked.
- Screens are tested end to end in `apps/server/e2e/app-*.spec.ts` against the built app. A fix or feature comes with
  a test that would fail without it.
- `npm test`, `npm run typecheck`, `npm run lint` and `npm run test:e2e` pass before a PR.

## Decisions and shipping

- Decisions go into ADRs in `docs/adr/`, not into `docs/BUILD.md`. Small rulings go into the PR description or here.
- Every change has a GitHub issue. Branch `gassi-<issue>-<slug>`, commit and PR title `GASSI #<issue>: …`, and the
  PR body says `Closes #<issue>`.
- Screen changes are shaped with mockups before they are built.

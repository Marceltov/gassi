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

- Only two people use Gassi, and it stays 0.x (tags `v0.N.0`). A renamed or removed route, endpoint or field is just
  deleted: no redirects, aliases or compatibility layers, even when an issue asks for one.

## Data

- Since 2026-10-22 the deployed Gassi holds real data. Deleting or resetting it isn't forbidden, but we are reluctant:
  a schema change comes with a migration that keeps the data, and a change that would lose data says so in its PR and
  is agreed before it merges (merging main deploys).

## Where code goes

- No redundancy anywhere: one implementation of a thing, shared through good abstractions and generics. Before adding
  a file or function, look for one to extend; duplicated routes, components or logic get folded (#65 is the first).
- A domain rule exists once, in `packages/domain` (no Node, React, Next or database there). The API exists once, in
  the contract in `packages/api-client` (ADR 0003).
- `apps/server/backend` is framework-free and reached from `app/` only through `backend/index.ts`.
- Screens in `apps/mobile/app` stay thin and render from `src/`. Platform differences sit behind a `.web.ts(x)` file
  next to the shared one (ADR 0006).
- Taps are idempotent commands with client ids (ADR 0001); "during a walk" is decided by time (ADR 0002).
- A fix to an installed package is a patch in `apps/mobile/patches/`, applied by the APK's EAS build, until upstream
  has it (ADR 0017); a new or changed patch bumps the runtime version.
- A route is stored as the raw points the phone sent and filtered once, in `packages/domain/src/trackFilter.ts`,
  wherever distance or a map is made (ADR 0014).

## Screens

- **Big buttons only on the go** (#68): Start, the walk and the training keep their sizes; everywhere else a page's
  main action is `m` (52) and side actions are `s` (44). Buttons side by side in one row share one height (the
  larger one's). The Futter sheet is not on the go.
- **Button colors and order** (#80): off the go, the buttons sit side by side, side actions left, the main action
  right taking the rest, one height (`ButtonRow`); a second side action goes above the row, and so does Geräte's "Hier
  abmelden" (Marcel). The main action has the color of the thing (Futter, Vorrat and food entries food, Pipi/Poopoo
  theirs, Gassi walk, Übungen/Leckerli training); where a page has none (Gewicht, Hunde, Geräte, Haushalt, Anmeldung)
  it is dark (`ink`). Side actions are outlined (`side`), Löschen and Entfernen a small trash icon outlined in red
  (`TrashButton`), a confirming "Ja, löschen" or "Ja, abmelden" red (`danger`) next to Abbrechen. Start, the walk and
  the training keep theirs.
- **Three zones** (#71): a page's title and what it shows stay at the top (`Screen`'s `head`); its controls stay at
  the bottom, bottom-aligned (`bottom`: switches and filters, side actions, the main action last). What the page
  shows, with a chooser that names it (Woche's week with ‹ ›), is the title and stays on top; filters that narrow a
  list (Verlauf's) stay at the bottom. Only what grows scrolls, between them (`top`), and only when it doesn't fit.
  Rows you read (a list) start under the title; rows you work in (Vorrat's counts) sit right above the controls. Rows
  in a list have one height: a heading and one subline, cut short rather than wrapping; a row with more to show may be
  taller, never shorter (a wet count a line per size, a training a line per exercise, a walk with a track its map). Nothing is cut off to make a page
  fit; Gewicht scales to the height instead (`fill`, #69). `e2e/fit.ts` checks each page at 360×640 and 430×932.
- **A write that worked says nothing**: the screen shows what changed. A message above the buttons would move them;
  only what went wrong is said there.
- **Text fields are at least 16 px**: an iPhone zooms into a smaller one when it gets the focus. `e2e/fit.ts` checks it
  on every page it opens.

## Formatting

- No formatter: the code is wrapped by hand, in long lines, matching the file around it. Never run Prettier (its
  defaults rewrap whole files); `.prettierignore` makes an accidental run a no-op. ESLint (`npm run lint`) is the check.

## Tests

- Tests sit next to the code. Outside calls (`fetch`, `now`, the database) are injected, not mocked.
- Screens are tested end to end in `apps/server/e2e/app-*.spec.ts` against the built app. A fix or feature comes with
  a test that would fail without it.
- `npm test`, `npm run typecheck`, `npm run lint` and `npm run test:e2e` pass before a PR.

## Decisions and shipping

- Decisions go into ADRs in `docs/adr/`, not into `docs/BUILD.md`. Small rulings go into the PR description or here.
- **The server goes first.** The Android app's code reaches the phones as an update from their server (#107, ADR
  0015), so a JS change needs no APK: merge, let the image reach the homelab (Watchtower pulls once a day at 11:54;
  `docker compose pull && docker compose up -d` in `/root/services/gassi` does it at once). An APK is only for new native
  parts: bump `runtimeVersion` in `apps/mobile/app.json` and `npm run runtime:record` (CI's runtime check fails
  otherwise); after the merge CI builds it once Marcel approves the `apk` environment. An app whose contract is newer
  than its server rejects the server's answers (#106); no tolerance for an older server in the client.
- Every change has a GitHub issue. Branch `gassi-<issue>-<slug>`, commit and PR title `GASSI #<issue>: …`, and the
  PR body says `Closes #<issue>`.
- Screen changes are shaped with mockups before they are built.

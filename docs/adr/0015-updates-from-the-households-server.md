---
status: accepted
date: 2026-10-25
decision-makers: Marcel Bruckner
---

# The Android app updates from the household's own server

## Context and Problem Statement

Every change to the Android app needed a new APK, built on EAS (15 a month on the free plan) and installed by hand,
while the PWA updated by itself. An app that falls behind its server rejects its answers (#106). The Android design
(step 3) asks for silent updates from the household's own server, with no Expo cloud in the path, for any household
(step 5), and an APK only when native parts change (#107).

## Considered Options

* EAS Update (Expo's hosted updates)
* The expo-updates protocol served by Gassi's server, unsigned
* The expo-updates protocol served by Gassi's server, the manifest signed in CI

## Decision Outcome

Chosen: **the protocol served by Gassi's server, signed in CI.**

* **The update is in the image.** `npm run build:app` exports the app for the web and Android; the Android bundle and
  its assets are public files next to the web app's. Its manifest (`public/_app-update/android.json`) names them by
  root-relative address, which the app resolves against the server it asks, so one manifest serves every household.
* **Signed once, in CI.** The image job signs the manifest with the key in the secret `UPDATES_SIGNING_KEY` (a
  BuildKit secret, never in a layer). The APK holds the certificate (`apps/mobile/certs`, keyid `main`) and takes only
  signed manifests; the manifest carries each file's hash, so the files are covered too. The server never holds the
  key and hands the manifest out as signed (`/api/updates/manifest`). A backup of the key is in 1Password (Homelab,
  "Gassi update signing key"); losing it means a new certificate and a reinstall on every phone.
* **The app asks its own server.** It points expo-updates at the server it signed in to
  (`setUpdateURLAndRequestHeadersOverride`, which needs `disableAntiBrickingMeasures`; the signature is what makes
  that safe). The first time for a server it asks to be closed and opened once. It checks at the start and on each
  return to the front and applies an update at once, unless this phone records a walk (then at its end).
* **Runtime version: a number with a guard.** `runtimeVersion` in app.json names one set of native parts; an update
  only reaches APKs of its runtime. `apps/mobile/runtime.json` records Expo's fingerprint for each number, and CI fails
  when the native parts change under the same number. `/api/app` tells the server's runtime; an app behind it says
  "Neue Version installieren", an app ahead says the server isn't updated yet.
* **The APK for a new runtime is built by CI, guarded.** Only on main, only when no release `apk-<runtime>` exists,
  only after Marcel approves the `apk` environment, never at 12 or more EAS builds a month, one at a time. It is
  published as that GitHub release, which the app links to. The image doesn't wait for it; meanwhile the app says the
  new version follows.

### Consequences

* Good: a JS change reaches Bille's phone with the next image, without a build or an install.
* Good: no Expo service in the path; any household's server serves the same signed update.
* Bad: without the anti-bricking fallback, a bundle that crashes at launch needs a reinstall; the e2e suite (same code)
  runs before every merge, and only CI can sign.
* Bad: a forgotten bump is caught by CI, but a new native module still costs an APK and an install.

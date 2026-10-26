---
status: accepted
date: 2026-10-26
decision-makers: Marcel Bruckner
---

# We fix installed packages with patches the APK's build applies

## Context and Problem Statement

A phone that once loaded an update from gassi.herziis.de never launches the same update from another server (#131).
Before sign-in the APK asks its built-in server and stores the update with that server's address. After sign-in to
another server, which runs the same image and so serves the same update id, expo-updates finds the stored row, adopts
the new server's scope key but keeps the old address, and the launcher, which only picks updates whose address matches
the configured one, finds nothing to launch at every start. The bug is in expo-updates (58.0.18, also the latest
release); nothing in JS, the app config or the server's signed manifest gets around it. Installs run without scripts
(`.npmrc`), so patch-package's usual `postinstall` would never run.

## Considered Options

* A patch to expo-updates, applied by the APK's EAS build
* `checkAutomatically: NEVER`, so nothing loads before sign-in (leaves switching servers broken, and the first start
  after sign-in runs the APK's bundle and can't reload)
* Leave it until upstream fixes it, and test with the app's network cut on its first start

## Decision Outcome

Chosen: **a patch, applied by the APK's EAS build**. Patches sit in `apps/mobile/patches/<package>+<version>.patch`
(patch-package's naming, made against `node_modules` at the repo root). `scripts/patches.mjs` applies them with
`git apply`; EAS runs it as `eas-build-post-install`. They only touch native code, so nothing else needs them. Expo's
fingerprint hashes the patches folder, so a new or changed patch bumps the runtime version like any native change.
`tooling/patches.test.ts` fails when a patch no longer fits the installed package, so an upgrade can't drop the fix
silently. The first patch takes over the address and headers of a stored update loaded again from elsewhere, next to
the scope key expo-updates already takes over.

### Consequences

* Good: other households (step 5, #20) and the test phone on gassi-dev.herziis.de get their server's updates.
* Bad: a patch has to be redone on every upgrade of its package; we drop it once upstream has the fix.

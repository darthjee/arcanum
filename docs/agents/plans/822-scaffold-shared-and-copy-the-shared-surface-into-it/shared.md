# Shared Plan: Scaffold shared/ and copy the shared surface into it

Main plan: [plan.md](plan.md)

## Overview

Scaffold `shared/` and copy the surface and its specs into it, following the [Shared Lib spec](../../specs/shared-lib.md) (Layout, Spec-file inventory, Testing, Tooling and CI). `core/` and `cli/` stay untouched; the copy window opens here and #824 closes it.

## Context

- Source of the copy: `core/lib/shared/config/` (`AgentEmail.js`, `ConfigChain.js`, `ConfigError.js`, `KeyRegistry.js`, `keys.json`, `RepoConfig.js`, `RepoConfigWriter.js`) and `core/lib/shared/file/` (`Lock.js`, `LockTimeoutError.js`, `RepoPath.js`). Every import in them is `node:` or relative inside the folder, so they copy unchanged.
- Specs come from `core/spec/lib/shared/{config,file}/`; support from `core/spec/support/`.
- Decisions from the refinement:
  - the `shared/lib/` copy stays byte-identical, including `KeyRegistry.js`'s error text `is not in core/lib/shared/config/keys.json` (#824 rewrites it);
  - devDependencies pinned exactly, like `cli/package.json`;
  - a boundary lint spec is added;
  - `shared` adds the two root `.gitignore` lines;
  - JSCPD is out of scope (#833).

## Steps

- [01 — Scaffold the package](shared/01-scaffold-package.md)
- [02 — ESLint config with the boundary rule](shared/02-eslint-config.md)
- [03 — Copy the lib](shared/03-copy-lib.md)
- [04 — Copy support and specs](shared/04-copy-specs.md)
- [05 — New specs: strict-keys default, zero dependencies, boundary](shared/05-new-specs.md)
- [06 — Set coverage thresholds and verify](shared/06-coverage-and-verify.md)

## CI Checks

There is no `shared` CI job yet (#823 adds it). Run locally, inside `shared/`:

- `yarn install` (generates `yarn.lock`)
- `yarn lint`
- `yarn test` (c8 with `check-coverage: true`)

No compose service exists yet either; run them with host Node 22.13+/yarn, or a throwaway container, e.g. `docker run --rm -v "$PWD":/w -w /w/shared node:22 sh -c "yarn install && yarn lint && yarn test"`.

Also confirm core and cli are unaffected (`make core-test`, `make cli-test` or their CI jobs) — nothing in them changes, so they must stay green.

## Notes

- Never edit `core/` or `cli/`, not even core's `Lock_spec.js` (it keeps its race block until #824).
- `shared/spec` must not import anything outside `shared/` (no `core/spec`, no `core/lib`, no `arcanum/_lib`).
- The drift rule applies from this PR on: an unavoidable surface change is made in both copies.
- `shared/spec/` is already excluded from the release zip and runtime image (#821); `shared/eslint.config.mjs` is already excluded too (#817's list, if merged first). Nothing in packaging changes here.

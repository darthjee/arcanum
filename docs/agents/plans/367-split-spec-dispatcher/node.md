# node Plan: Split spec dispatcher

Main plan: [plan.md](plan.md)

## Overview

Delete `core/spec/lib/core/dispatcher_spec.js` and redistribute its 21 `it`s (unchanged)
across four new sibling files, split by concern:

| New spec file | Top-level `describe`(s) moved in | `it`s |
|---|---|---|
| `dispatcherContextRouting_spec.js` | `context: 'none' path`, `context: 'repo' path`, `context: 'claude' path` | 8 |
| `dispatcherContextGetters_spec.js` | `repoContext getter`, `claudeContext getter` | 4 |
| `dispatcherInvocationLog_spec.js` | `InvocationLog recording` (+ its preceding explanatory comment about `#342`) | 2 |
| `dispatcherErrorHandling_spec.js` | `unknown command`, `context: 'repo' repoPath validation` | 7 |

Total: 21 `it`s — identical to the original (4 + 2 + 2 + 2 + 2 + 2 + 1 + 6).

## Context

- The original file wraps all 8 sub-`describe`s in one `describe('Dispatcher', () => { … })`.
  Follow the established split pattern from the sibling issues #362–#366 (e.g.
  `IssueStateServiceSet_spec.js` uses `describe('IssueStateService (field setters)', …)`):
  each new file gets its own single top-level wrapper `describe('Dispatcher (<concern>)', …)`
  with the original sub-`describe`s nested inside, unchanged.
- Module-level shared code in the original:
  - `noopInvocationLog` const — used **only** by the `repoPath validation` block →
    `dispatcherErrorHandling_spec.js` only.
  - `fakeInvocationLog(events)` helper — used by **both** `InvocationLog recording` and the
    `repoPath validation` block → copy into `dispatcherInvocationLog_spec.js` **and**
    `dispatcherErrorHandling_spec.js`. Per the issue, copy the two small locals as needed
    rather than extracting a shared support module.
- Import usage across the split (from the original's 6 imports):
  - `Dispatcher` — all four files.
  - `mkdir, writeFile` (`node:fs/promises`), `path` — only the `context: 'none' path`
    `beforeEach` → routing file only.
  - `RepoContext` — only `context: 'repo' path` assertions → routing file only.
  - `ClaudeContext` — only `context: 'claude' path` assertions → routing file only.
  - `createTempDir, removeTempDir` (`../../support/utils/tempDir.js`) — `context: 'none'
    path` **and** the `repoPath validation` block → routing file **and** error-handling file.
  - `jasmine` / `spyOn` / `expectAsync` are Jasmine globals — no import.
- Relative import depth is unchanged (`core/spec/lib/core/` → `../../../lib/…`,
  `../../support/…`); the new files sit in the same directory as the original, so every
  import path is copied verbatim.
- No behavior, assertion, or coverage change. `dispatcher.js` is not touched.

## Steps

- [01 — Create dispatcherContextRouting_spec.js](node/01-create-context-routing-spec.md)
- [02 — Create dispatcherContextGetters_spec.js](node/02-create-context-getters-spec.md)
- [03 — Create dispatcherInvocationLog_spec.js](node/03-create-invocation-log-spec.md)
- [04 — Create dispatcherErrorHandling_spec.js](node/04-create-error-handling-spec.md)
- [05 — Delete the original and verify](node/05-delete-original-and-verify.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`, i.e. `c8 jasmine`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`, i.e. `eslint .`)

## Notes

- `jscpd` duplication is scoped to `core/lib` only (`core/.jscpd.json` has
  `"ignore": ["**/spec/**"]`), so copying `fakeInvocationLog`/`noopInvocationLog` into
  multiple spec files raises no duplication report.
- Done when: `dispatcher_spec.js` is gone; the four new files exist with every `it` from the
  original unchanged; `make core-test` passes with the same total spec count; `make
  core-lint` is clean; coverage for `core/lib/core/dispatcher.js` is unchanged.
- Out of scope: any change to `dispatcher.js`, `commands.js`, `RepoContext`,
  `ClaudeContext`, `InvocationLog`; `commands_spec.js` / `InvocationLog_spec.js`;
  `core/spec/bin/arcanum_spec.js`.

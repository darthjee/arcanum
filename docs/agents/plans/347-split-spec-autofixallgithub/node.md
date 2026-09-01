# node Plan: Split spec AutoFixAllGithub

Main plan: [plan.md](plan.md)

## Overview

`core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js` (456 lines, 28 `it`s) tests
all 7 subcommands of the `AutoFixAllGithub` facade plus constructor wiring in one file, on
top of ~90 lines of inline fakes (`fakeExecFileAsync`, `fakeFetch`, `newGithub`).

This plan:

1. Lifts the three inline fakes into a new shared module
   `core/spec/support/factories/autoFixAllGithub.js`.
2. Splits the spec into three sibling files along the source's own seam (the delegate each
   subcommand routes through):
   - `AutoFixAllGithubWiring_spec.js` — `constructor wiring` (2 `it`s)
   - `AutoFixAllGithubPrAndBranch_spec.js` — `#prNumber`, `#prState`, `#prMerge`,
     `#cleanupBranch` (9 `it`s) — `PrOperations` / `BranchCleanup`
   - `AutoFixAllGithubLabels_spec.js` — `#hasShipitLabel`, `#addTag`, `#removeTag` (17 `it`s)
     — `IssueTagger` / `TagMutationService`
3. Deletes the original `AutoFixAllGithub_spec.js`.

Every `it` moves **verbatim** — no assertion text, wiring, or fake behavior changes. Total
`it` count stays 28 (2 + 9 + 17).

## Context

- The class under test (`core/lib/commands/auto-fix-all/AutoFixAllGithub.js`, ~205 lines) is
  a thin facade already refactored under plan #304 to delegate to `PrOperations`,
  `IssueTagger`, `TagMutationService`, `BranchCleanup`. **Not touched by this plan.**
- Nothing imports `AutoFixAllGithub_spec.js` (verified) — it is a leaf spec file, safe to
  rename/delete.
- Sibling specs in the same folder import support helpers via
  `../../../support/utils/...` / `../../../support/factories/...` (three levels up from
  `core/spec/lib/commands/auto-fix-all/` to `core/spec/support/`). Example:
  `AutoFixAllReplyComment_spec.js` imports
  `../../../support/factories/repoContextFactory.js`.
- `core/spec/support/factories/` holds object builders (`repoContextFactory.js`), keyed by
  their module path; `core/spec/support/utils/` holds fake builders. A `fakeFetch.js`
  already exists under `support/utils/` with a **narrower** shape (label mutation only), so
  the extracted fetch fake must not reuse that bare name — hence `fakeGithubFetch`.
- Jasmine (`core/spec/support/jasmine.json`) has `helpers: []` and spec globs
  `lib/**/*_spec.js` / `bin/**/*_spec.js`. Support modules are imported directly by specs,
  not auto-loaded — **no jasmine config change needed**, and the three new `*_spec.js`
  files are picked up automatically by the existing glob.
- No `max-lines` (or similar) ESLint rule exists — the split is a maintainability choice,
  not a lint fix.

## Steps

- [01 — Extract shared test helpers into a support factory](node/01-extract-shared-helpers.md)
- [02 — Create AutoFixAllGithubWiring_spec.js](node/02-split-wiring-spec.md)
- [03 — Create AutoFixAllGithubPrAndBranch_spec.js](node/03-split-pr-and-branch-spec.md)
- [04 — Create AutoFixAllGithubLabels_spec.js and delete the original](node/04-split-labels-spec.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`, run with coverage)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`)

After the split, `make core-test` must report the **same total spec count** as before
(28 `it`s for this area, unchanged repo-wide total), `make core-lint` must be clean, and
per-file coverage for `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` must be unchanged.

## Notes

- The original spec defines module-level constants `REPO = 'darthjee/arcanum'`,
  `TOKEN = 'fake-token'`, `REPO_PATH = '/fake/repo'` that both `newGithub` and several
  assertions use. Export these three from the new factory module alongside the helpers so
  each split file imports them rather than redeclaring.
- `DispatchFailure` is a production class (not a helper) asserted on by the
  `#hasShipitLabel` tests — the Labels spec keeps importing it directly from
  `../../../../lib/utils/errors/DispatchFailure.js`, it does **not** go through the factory
  module.
- The `PULL` constant local to the `#prMerge` `describe` block stays inline in the
  PrAndBranch spec (it is scoped to that block, not shared).
- Alternative helper layout (separate `support/utils/fakeGithubFetch.js` +
  `support/utils/fakeGitExecFileAsync.js` + `support/factories/autoFixAllGithub.js`) is
  acceptable if a reviewer prefers strict utils/factories separation — the bundled module
  is chosen here for a single short import line per spec.

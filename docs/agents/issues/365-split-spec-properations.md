# Issue: Split spec PrOperations

## Description

`core/spec/lib/utils/github/PrOperations_spec.js` is 289 lines, covering all 5 public methods
of `PrOperations` (`core/lib/utils/github/PrOperations.js`, ~180 lines): `#prNumber`,
`#prState`, `#headSha`, `#checkRuns`, `#prMerge` (the last with a nested `"coauthors" mode`
describe).

## Problem

`#prMerge` alone (11 `it`s, including its nested coauthors-mode block) is nearly half the
file, covering cache-vs-REST resolution, all four `merge_body_mode` variants, merge/branch-
delete failure paths. `#headSha`/`#checkRuns` are each a single 1-`it` pure-delegation test —
too small to justify their own file each. All describes share one inline `fakeGit()` +
`fakeGithubClient()` pair and a local `newPrOperations()` builder.

## Solution

Spec-only reorganization. `PrOperations.js` is **not** touched — no production code and no
assertions change.

### Split into 3 files

Split by behavioral weight: `#prNumber` and `#prMerge` each get their own file (the two
richest methods); the three simple query methods (`#prState`, `#headSha`, `#checkRuns`) are
grouped into one file — as flat sibling files in `core/spec/lib/utils/github/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `PrOperationsPrNumber_spec.js` | `PrOperations#prNumber` | the current `#prNumber` block (5 `it`s) |
| `PrOperationsQueries_spec.js` | `PrOperations (query methods)` | `#prState` (5 `it`s), `#headSha` (1 `it`), `#checkRuns` (1 `it`) |
| `PrOperationsPrMerge_spec.js` | `PrOperations#prMerge` | the current `#prMerge` block including the nested `"coauthors" mode` describe (11 `it`s total) |

Approx sizes: ~40 / ~60 / ~140 lines. The original `PrOperations_spec.js` is deleted; every
`it` moves verbatim into one of the three files.

Rejected alternative: one file per method (5 files) — leaves `#headSha`/`#checkRuns` as
2 separate ~12-line runt files.

### Extract shared helpers

Move the inline `fakeGit(opts)`, `fakeGithubClient(config)`, and `newPrOperations(opts)`
helpers into a new module, **`core/spec/support/factories/prOperations.js`**, imported by all
three specs. Behavior is copied verbatim; `newPrOperations` continues to compose
`createRepoContextMock` from the existing `core/spec/support/factories/repoContextFactory.js`.

### Done when

- `PrOperations_spec.js` is gone; the three new files exist with every `it` from the original,
  unchanged, distributed per the split axis above.
- The shared-helper module exists and the three specs import from it (no copy-pasted
  helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/utils/github/PrOperations.js` is unchanged.

### Out of scope

- Any change to `PrOperations.js` or its collaborators (`GitClient`, `GitHubClient`,
  `GitBranch`, `Git`, `MergeBodyResolver`).
- `MergeBodyResolver_spec.js` / `GitHubClient_spec.js` (separate, already-reasonable-size
  files) — not touched here.
- The `bin/autoFixAllGithubParity/pr_number_spec.js` / `pr_state_spec.js` / `pr_merge_spec.js`
  parity specs — already split, not touched here.

## Benefits

- The two behaviorally-rich methods each get a focused file; the three simple query methods
  stay grouped instead of fragmenting into runt files.
- The shared fakes/builder live in one reusable place.
- Pure navigability improvement — no behavior or coverage change, low review risk.

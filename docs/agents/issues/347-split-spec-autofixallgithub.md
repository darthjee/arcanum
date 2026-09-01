# Issue: Split spec AutoFixAllGithub

## Description

`core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js` is 456 lines — the largest
spec in the `auto-fix-all/` folder (next largest is `AutoFixAllQueue_spec.js` at 385). One
file covers all 7 GitHub-facing subcommands of `AutoFixAllGithub` plus constructor wiring,
on top of ~90 lines of local test fakes.

The class under test (`core/lib/commands/auto-fix-all/AutoFixAllGithub.js`, ~205 lines) is a
thin facade, already refactored under plan #304 to delegate to `PrOperations`,
`IssueTagger`, `TagMutationService`, and `BranchCleanup`.

## Problem

The single large spec is hard to navigate and mixes unrelated concerns (PR lifecycle,
branch teardown, label reads, tag mutation, DI wiring). Its three shared fakes
(`fakeExecFileAsync`, `fakeFetch`, `newGithub`) are defined inline, so any split would
otherwise duplicate them across files.

## Solution

Spec-only reorganization. `AutoFixAllGithub.js` and its delegates are **not** touched — the
plan #304 extraction is considered done. No production code and no assertions change.

### Split into 3 files

Split along the same seam the source is organized on — the delegate each subcommand routes
through — as flat sibling files in `core/spec/lib/commands/auto-fix-all/`:

| New spec file | Top-level `describe` | Covers | Delegate(s) |
|---|---|---|---|
| `AutoFixAllGithubWiring_spec.js` | `AutoFixAllGithub (wiring)` | the current `constructor wiring` block (shared origin/token instances; per-call routing through the injected `execFileAsync`/`fetchFn` bound to the context `repoPath`) | cross-cutting |
| `AutoFixAllGithubPrAndBranch_spec.js` | `AutoFixAllGithub (PR & branch subcommands)` | `#prNumber`, `#prState`, `#prMerge`, `#cleanupBranch` | `PrOperations`, `BranchCleanup` |
| `AutoFixAllGithubLabels_spec.js` | `AutoFixAllGithub (label subcommands)` | `#hasShipitLabel`, `#addTag`, `#removeTag` | `IssueTagger`, `TagMutationService` |

Approx test-body sizes: ~65 / ~91 / ~166 lines. The original `AutoFixAllGithub_spec.js` is
deleted; every `it` moves verbatim into one of the three files.

Rejected alternatives:
- One file per delegate (4 files) — leaves `#cleanupBranch` as a ~25-line runt file.
- Two files (PR side vs label side) — the `constructor wiring` shared-instances test
  touches both paths, so it has no clean home.
- One file per method (~7 files) — over-fragmented for a facade this thin; several files
  under 20 lines.
- Per-class subdir `AutoFixAllGithub/` — under `core/spec/lib/`, subdirectories only ever
  mirror the source folder tree, never a single class.

### Extract shared helpers

Move the three inline helpers into one new module,
**`core/spec/support/factories/autoFixAllGithub.js`**, imported by all three specs:

- `createAutoFixAllGithub(overrides)` — the current `newGithub` body, unchanged behavior.
- `fakeGithubFetch(config)` — the current `fakeFetch`, renamed to avoid the name clash with
  the existing narrower `core/spec/support/utils/fakeFetch.js` (that one only covers
  `IssueTagger` label mutation; this one additionally covers `/pulls`, `/pulls/:n/commits`,
  `/pulls/:n/merge`, and `/user`).
- `fakeGitExecFileAsync(opts)` — the current `fakeExecFileAsync`.

Helper behavior is copied verbatim. Splitting instead into `support/utils/fakeGithubFetch.js`
+ `support/utils/fakeGitExecFileAsync.js` + `support/factories/autoFixAllGithub.js` is an
acceptable alternative if a reviewer prefers the strict utils/factories separation.

No jasmine config change needed: support modules are imported directly by specs, not
auto-loaded (`helpers: []`; the spec globs already match `lib/**/*_spec.js`).

### Done when

- `AutoFixAllGithub_spec.js` is gone; the three new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and the three specs import from it (no copy-pasted
  helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` is unchanged.

### Out of scope

- Any change to `AutoFixAllGithub.js` or its delegates.
- Splitting the other `AutoFixAll*_spec.js` files (`AutoFixAllQueue_spec.js` next-largest) —
  a separate issue if wanted.
- The `bin/autoFixAllGithubParity/` parity specs — already split, not touched here.
- No migration, no skill/script changes, no new top-level folder.

## Benefits

- Each file covers one coherent slice of the facade, matching the source's own structure.
- The shared fakes live in one reusable place instead of being copy-pasted across the split.
- Pure navigability improvement — no behavior or coverage change, low review risk.

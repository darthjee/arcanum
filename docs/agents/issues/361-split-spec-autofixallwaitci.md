# Issue: Split spec AutoFixAllWaitCi

## Description

`core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCi_spec.js` is 351 lines. Every test lives
under a single `describe('#run')`, with nine nested scenario `describe`s (usage error, no PR
found, zero check-runs, ignored patterns, all-success, failure, pending, transient errors) plus
one bare `it` (bearer-token header), on top of ~85 lines of shared local test fakes
(`fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, `stubRepoConfig`).

The class under test (`core/lib/commands/auto-fix-all/AutoFixAllWaitCi.js`, ~129 lines) is a
thin poll-loop orchestrator that delegates PR-number resolution to `PrOperations` and the
poll-once decision tree to `PrChecker` (see plan #300) — this issue is spec-only
reorganization.

## Problem

`#run`'s nine scenarios span four different concerns (can the poll even start; which check-run
outcome does it resolve to; how are ignored patterns handled; how are transient REST errors
retried), all interleaved in one 350-line file behind a shared, fairly involved `fakeFetch` that
simulates three different REST endpoints with per-call response sequences. That fake is only
usable inside this one file today.

## Solution

Spec-only reorganization. `AutoFixAllWaitCi.js`, `PrOperations`, and `PrChecker` are **not**
touched — no production code and no assertions change.

### Split into 4 files

Split into 4 flat sibling files in `core/spec/lib/commands/auto-fix-all/`, grouped by concern
within this unit spec (this does *not* mirror the sibling shell-parity suite's own split under
issue #350 — `core/spec/bin/autoFixAllWaitCiParity/` uses a different, 3-way axis:
`preconditions_spec.js`, `ci_outcomes_spec.js` (bundles ignored-pattern checks with pass/fail
outcomes), and `engine_dispatch_spec.js` (shell-vs-native routing, unrelated to this spec's
transient-error retries) — the two suites test different things and don't need matching axes):

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `AutoFixAllWaitCiUsage_spec.js` | `AutoFixAllWaitCi (usage & no PR)` | missing `repo_path`, "no pull request found" (including the pulls-lookup-rejects variant) |
| `AutoFixAllWaitCiIgnoredPatterns_spec.js` | `AutoFixAllWaitCi (ignored check patterns)` | the `ignored check patterns` block |
| `AutoFixAllWaitCiOutcomes_spec.js` | `AutoFixAllWaitCi (check-run outcomes)` | zero check-runs, all-success, failure/cancelled/timed-out, still-pending |
| `AutoFixAllWaitCiTransientErrors_spec.js` | `AutoFixAllWaitCi (transient errors & auth)` | the `transient fetch/API errors` block, plus the bearer-token header `it` |

Approx test-body sizes: ~35 / ~40 / ~90 / ~90 lines. The original `AutoFixAllWaitCi_spec.js` is
deleted; every `it` moves verbatim into one of the four files, each keeping its own
`describe('#run')` wrapper.

Rejected alternatives:
- One file per scenario describe (9 files) — several would be under 20 lines (e.g. "zero
  check-runs" is a single 15-line `it`).
- Two files (start-up failures vs. steady-state outcomes) — the ignored-patterns and
  transient-error scenarios don't cleanly fit either bucket.

### Extract shared helpers

Move `fakeExecFileAsync`, `fakeFetch`, `newWaitCi`, and `stubRepoConfig` into a new module,
**`core/spec/support/factories/autoFixAllWaitCi.js`**, imported by all four specs. Helper
behavior is copied verbatim — `fakeFetch`'s per-call response-sequence design already supports
every scenario across the split without modification.

No jasmine config change needed: support modules are imported directly by specs (`helpers: []`).

### Done when

- `AutoFixAllWaitCi_spec.js` is gone; the four new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and all four specs import from it (no copy-pasted helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/auto-fix-all/AutoFixAllWaitCi.js` is unchanged.

### Out of scope

- Any change to `AutoFixAllWaitCi.js`, `PrOperations`, or `PrChecker`.
- The `bin/autoFixAllWaitCiParity/` split (issue #350) — separate, already covered.
- No migration, no skill/script changes, no new top-level folder.

## Benefits

- Each file covers one coherent concern (start-up validation, ignored-pattern filtering,
  outcome resolution, resiliency), mirroring the already-split parity suite for the same
  entrypoint.
- The shared fake-fetch/exec helpers live in one reusable place instead of being copy-pasted.
- Pure navigability improvement — no behavior or coverage change, low review risk.

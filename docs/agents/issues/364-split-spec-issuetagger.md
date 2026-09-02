# Issue: Split spec IssueTagger

## Description

`core/spec/lib/utils/issue/IssueTagger_spec.js` is 304 lines, covering all 7 public methods
of `IssueTagger` (`core/lib/utils/issue/IssueTagger.js`, ~190 lines): `#markEnqueued`,
`#mutateTag`, `#fetchLabels`, `#addLabel`, `#removeLabel`, `#hasLabel`,
`#warnMutationFailure`.

## Problem

The two largest methods (`#markEnqueued`, `#mutateTag`) carry most of the file's real
behavioral coverage (DispatchFailure paths, stdout/stderr message assertions, domain
qualification), while the remaining five methods are thin single-call wrappers around
`IssueClient`/`#fetchLabels` with 2-3 `it`s each. All seven describes share one inline
`fakeIssueClient()` factory and a local `newTagger()` builder. Splitting strictly one file
per method would leave `#fetchLabels`, `#addLabel`, `#removeLabel`, `#hasLabel`, and
`#warnMutationFailure` as five ~15-20-line runt files — worse for navigation than the
current single file.

## Solution

Spec-only reorganization. `IssueTagger.js` is **not** touched — no production code and no
assertions change.

### Split into 3 files

Split by behavioral weight — each of the two substantial methods gets its own file; the five
thin wrapper methods are grouped into one file — as flat sibling files in
`core/spec/lib/utils/issue/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `IssueTaggerMarkEnqueued_spec.js` | `IssueTagger#markEnqueued` | the current `#markEnqueued` block (5 `it`s) |
| `IssueTaggerMutateTag_spec.js` | `IssueTagger#mutateTag` | the current `#mutateTag` block (7 `it`s) |
| `IssueTaggerLabelOperations_spec.js` | `IssueTagger (label operations)` | `#fetchLabels`, `#addLabel`, `#removeLabel`, `#hasLabel`, `#warnMutationFailure` (11 `it`s total across 5 nested describes) |

Approx sizes: ~95 / ~75 / ~110 lines. The original `IssueTagger_spec.js` is deleted; every
`it` moves verbatim into one of the three files.

Rejected alternative: one file per method (7 files) — leaves 5 files under 20 lines each.

### Extract shared helpers

Move the inline `fakeIssueClient(opts)` and `newTagger(opts)` helpers into a new module,
**`core/spec/support/factories/issueTagger.js`**, imported by all three specs. Behavior is
copied verbatim; `newTagger` continues to compose `createRepoContextMock` from the existing
`core/spec/support/factories/repoContextFactory.js`.

### Done when

- `IssueTagger_spec.js` is gone; the three new files exist with every `it` from the original,
  unchanged, distributed per the split axis above.
- The shared-helper module exists and the three specs import from it (no copy-pasted
  helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/utils/issue/IssueTagger.js` is unchanged.

### Out of scope

- Any change to `IssueTagger.js` or its collaborators (`IssueClient`, `Tags`,
  `DispatchFailure`).
- `Tags_spec.js` (a separate, already-small file) — not touched here.

## Benefits

- The two behaviorally-rich methods each get a focused file; the thin wrappers stay grouped
  instead of fragmenting into runt files.
- The shared fake/builder live in one reusable place.
- Pure navigability improvement — no behavior or coverage change, low review risk.

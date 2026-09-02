# Issue: Split spec AutoFixAllReplyComment

## Description

`core/spec/lib/commands/auto-fix-all/AutoFixAllReplyComment_spec.js` is 297 lines. All tests
live under a single `describe('#run')`, with five nested scenario blocks (argument validation,
the happy path, REST-call failure, `resolve_pr_number.sh` failure, `git push` failure), on top
of ~90 lines of shared local test fakes (`fakeReadFile`, `fakeExecFileAsync`, `stubDeps`,
`newContext`).

The class under test (`core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`, ~217 lines)
is a thin orchestrator that shells out to `resolve_pr_number.sh`, renders a reply template,
posts it via `IssueClient`, then pushes the branch — this issue is spec-only reorganization.

## Problem

"Argument validation" alone is 8 near-identical `it`s (~80 lines) covering each of the 5
required arguments, dwarfing the other four scenario blocks combined and making the file's
actual behavioral coverage (happy path, three distinct failure modes) hard to scan past it.

## Solution

Spec-only reorganization. `AutoFixAllReplyComment.js` and its delegate (`IssueClient`) are
**not** touched — no production code and no assertions change.

### Split into 3 files

Split as flat sibling files in `core/spec/lib/commands/auto-fix-all/`:

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `AutoFixAllReplyCommentValidation_spec.js` | `AutoFixAllReplyComment (argument validation)` | the `argument validation` block (8 `it`s) |
| `AutoFixAllReplyCommentHappyPath_spec.js` | `AutoFixAllReplyComment (happy path)` | the `the happy path` block |
| `AutoFixAllReplyCommentFailureModes_spec.js` | `AutoFixAllReplyComment (failure modes)` | `when the REST call fails`, `when resolve_pr_number.sh fails`, `when git push fails` |

Approx test-body sizes: ~80 / ~40 / ~55 lines. The original `AutoFixAllReplyComment_spec.js`
is deleted; every `it` moves verbatim into one of the three files, each keeping its own
`describe('#run')` wrapper.

Rejected alternatives:
- One file per failure mode (3 files instead of 1 grouped file) — each REST/resolve/push
  failure block is a single ~15-line `it`; grouping them keeps "what can go wrong" scannable
  in one place without runt files.
- Leaving argument validation inline with the happy path — defeats the purpose of the split,
  since validation is the single largest block.

### Extract shared helpers

Move `fakeReadFile`, `fakeExecFileAsync`, `stubDeps`, and `newContext` into a new module,
**`core/spec/support/factories/autoFixAllReplyComment.js`**, imported by all three specs.
`newContext` currently closes over the outer `beforeEach`'s `repoPath` — parameterize it to
take `repoPath` explicitly so it works standalone in each split file (each file keeps its own
`beforeEach`/`afterEach` temp-dir setup). All other helper behavior is copied verbatim.

No jasmine config change needed: support modules are imported directly by specs (`helpers: []`).

### Done when

- `AutoFixAllReplyComment_spec.js` is gone; the three new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and all three specs import from it (no copy-pasted helpers),
  with `newContext` taking `repoPath` as an explicit parameter.
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` is unchanged.

### Out of scope

- Any change to `AutoFixAllReplyComment.js` or `IssueClient`.
- The `bin/autoFixAllReplyCommentParity_spec.js` split (issue #356) — separate, already
  covered.
- No migration, no skill/script changes, no new top-level folder.

## Benefits

- Argument validation (bulk, repetitive) is separated from actual behavioral coverage (happy
  path, failure modes), making each easier to scan and extend.
- The shared fakes live in one reusable place instead of being copy-pasted across the split.
- Pure navigability improvement — no behavior or coverage change, low review risk.

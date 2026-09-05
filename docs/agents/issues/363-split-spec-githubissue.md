# Issue: Split spec GithubIssue

## Description

`core/spec/lib/commands/shared/GithubIssue_spec.js` is 387 lines — the largest spec in
`lib/commands/shared/`. One file covers all three public methods of `GithubIssue`
(`core/lib/commands/shared/GithubIssue.js`, ~260 lines): `#fetch`, `#info`, `#create`, plus a
separate nested `context-injected (CLI flag-on) path` block that re-tests `#create`/`#info`
under the CLI-injected-`RepoContext` calling convention.

## Problem

The single large spec mixes three independent concerns (fetching an issue, resolving
domain/repo info, creating an issue) and duplicates a `stubDeps()`/`loadFixture()` pair of
inline helpers that every describe block reaches for. The nested "context-injected" describe
also physically separates each method's CLI-path test from that same method's main test
block, making it easy to miss when changing one path but not the other.

## Solution

Spec-only reorganization. `GithubIssue.js` is **not** touched — no production code and no
assertions change.

### Split into 3 files

Split along the class's own method axis, as flat sibling files in
`core/spec/lib/commands/shared/`, folding each method's "context-injected" variant into that
same method's file (so the two calling conventions for one method stay side by side instead
of living in separate top-level describes):

| New spec file | Top-level `describe` | Covers |
|---|---|---|
| `GithubIssueFetch_spec.js` | `GithubIssue#fetch` | the current `#fetch` block (8 `it`s: happy path, REST URL/auth header, label→tag mapping, title slugging, fetch-failure, network-error, auth-failure, timeout) |
| `GithubIssueInfo_spec.js` | `GithubIssue#info` | the current `#info` block (3 `it`s) plus the context-injected path's `#info` block (1 `it`) |
| `GithubIssueCreate_spec.js` | `GithubIssue#create` | the current `#create` block (8 `it`s) plus the context-injected path's `#create` block (1 `it`) |

Approx sizes: ~140 / ~55 / ~195 lines. The original `GithubIssue_spec.js` is deleted; every
`it` moves verbatim into one of the three files (the context-injected `it`s move into their
matching method's file rather than staying grouped together).

Rejected alternatives:
- Keep the `context-injected (CLI flag-on) path` describe as a 4th file — splits each
  method's two calling-convention tests across two files instead of keeping them adjacent.
- One file per method without merging in the context-injected tests (4 files total) — same
  problem, just inverted.

### Extract shared helpers

Move the inline `stubDeps(overrides)` and `loadFixture(name)` helpers into a new module,
**`core/spec/support/factories/githubIssue.js`**, imported by all three specs. Behavior is
copied verbatim — `loadFixture` reads from the existing `core/spec/support/fixtures/`
directory (`github_issue_success.json`, `github_issue_not_found.json`,
`github_issue_create_success.json`), whose location doesn't change.

### Done when

- `GithubIssue_spec.js` is gone; the three new files exist with every `it` from the original,
  unchanged, distributed per the split axis above.
- The shared-helper module exists and the three specs import from it (no copy-pasted
  helpers).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.
- Coverage for `core/lib/commands/shared/GithubIssue.js` is unchanged.

### Out of scope

- Any change to `GithubIssue.js` or its collaborators (`IssueClient`, `IssueStateService`,
  `Origin`, `GithubToken`, `Tags`, etc.).
- The `bin/githubIssueInfoParity_spec.js` / `bin/githubIssueCreateParity_spec.js` parity
  specs — separate files, not touched here.

## Benefits

- Each file covers one coherent method, with both its calling conventions tested together.
- The shared fixture-loading/stub helpers live in one reusable place.
- Pure navigability improvement — no behavior or coverage change, low review risk.

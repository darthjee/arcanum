# Issue: Split spec IssueStateParity

## Description

`core/spec/bin/issueStateParity_spec.js` is 269 lines — a shell-vs-native parity suite for the
`issue-state` migrated entrypoint, covering all 13 top-level `describe` blocks for its four
subcommands (`get`, `set`, `set-json`, `append-json`) plus argument/repo-path validation, all
in one file, sharing one top-level `beforeEach`/`afterEach` (git-init'd shell/native temp
repos) and two locally-closured helpers, `runBoth` and `assertStateFilesMatch`.

## Problem

Four subcommands' worth of scenarios (13 describes total) sit in one file. Unlike this batch's
other helper functions, `runBoth`/`assertStateFilesMatch` close over the per-test
`shellRepo`/`nativeRepo` variables from the outer `describe`'s `beforeEach` rather than taking
them as parameters — a naive copy-paste split would need to either duplicate the
`beforeEach`/`afterEach` per file (fine, ~10 lines) or extract these two helpers to take repo
paths explicitly.

## Solution

Spec-only reorganization. No changes to `issue_state_shell.sh` or the native `issue-state`
implementation. No assertions change — every `it` moves verbatim.

### Split into 5 files, by subcommand

New directory `core/spec/bin/issueStateParity/`, mirroring the existing
`autoFixAllQueueParity/` / `autoFixAllGithubParity/` split convention (the original monolith
is deleted):

| New spec file | Covers (describe blocks) |
|---|---|
| `get_spec.js` | `get on a missing state file`, `get on a missing field`, `get on an existing field` |
| `set_spec.js` | `set creating a new field`, `set overwriting an existing field` |
| `set_json_spec.js` | `set-json with an object value`, `set-json with an array value` |
| `append_json_spec.js` | `append-json on a field that does not exist yet`, `append-json on a field that is already an array` |
| `argument_validation_spec.js` | `missing required args`, `an unknown subcommand`, `a present-but-non-directory repo_path`, `a non-git repo_path` |

### Extract shared helpers

Move `runCommand`, `runBoth`, and `assertStateFilesMatch` into a shared support module (e.g.
`core/spec/support/factories/issueStateParity.js`), rewriting `runBoth`/
`assertStateFilesMatch` to accept `shellRepo`/`nativeRepo` as explicit parameters instead of
closing over outer-scope variables (behavior unchanged — each file's own
`beforeEach`/`afterEach` still builds/tears down its own fixture-repo pair, matching the
`autoFixAllConfigParity/`-style precedent of small per-file setup blocks).

### Done when

- `issueStateParity_spec.js` is gone; the five new files exist with every `it` from the
  original, unchanged, distributed per the split axis above.
- The shared-helper module exists and all five specs import from it (no copy-pasted helpers
  beyond the small per-file `beforeEach`/`afterEach`).
- `make core-test` passes with the same total spec count as before, and `make core-lint` is
  clean.

### Out of scope

- Any change to `issue_state_shell.sh` or the native `issue-state` implementation.

## Benefits

- Matches the existing `autoFixAllQueueParity/` one-subcommand-per-file convention.
- Each subcommand's tests are independently readable/locatable.
- Pure navigability improvement — no behavior or coverage change, low review risk.

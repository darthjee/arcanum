# node Plan: Split spec IssueStateParity

Main plan: [plan.md](plan.md)

## Overview

Break `core/spec/bin/issueStateParity_spec.js` into a `core/spec/bin/issueStateParity/`
directory of five per-subcommand spec files, mirroring the existing `autoFixAllConfigParity/`
split. Move `runBoth` and `assertStateFilesMatch` (plus a `createFixtureRepo` builder and the
`SHELL_SCRIPT` / `NATIVE_BIN` constants) into a new
`core/spec/support/factories/issueStateParitySetup.js`, rewriting the two helpers to accept
the `shellRepo` / `nativeRepo` fixture paths as explicit parameters instead of closing over
outer-scope variables. Delete the monolith. Pure navigability change — no production code
touched, no assertion changed.

## Context

- `core/spec/bin/issueStateParity_spec.js` is the shell-vs-native parity suite for the
  `issue-state` migrated entrypoint (issue #238). One top-level
  `describe('issue-state parity (shell vs. native)')` wraps 13 inner `describe` blocks with
  one `it` each (13 tests total), across four subcommands (`get`, `set`, `set-json`,
  `append-json`) plus four argument / repo-path validation cases.
- One top-level `beforeEach` / `afterEach` builds and tears down a git-init'd `shellRepo` /
  `nativeRepo` temp-dir pair. Three helpers are defined inline: `runCommand([file, ...args], cwd)`
  (byte-identical to the shared `core/spec/support/utils/runCommand.js` export), `runBoth(args)`
  and `assertStateFilesMatch(id)` — the last two close over `shellRepo` / `nativeRepo`.
- Precedent for this exact split: `core/spec/bin/autoFixAllConfigParity/` +
  `core/spec/support/factories/autoFixAllConfigParitySetup.js` (issue #261), and
  `autoFixAllReplyCommentParity/` (issue #356). Both keep a small per-file
  `beforeEach` / `afterEach` calling a `createFixtureRepo(prefix)` helper that returns a
  git-init'd temp-dir path, pass the repo pair explicitly into the shared run helper, and add
  a concern suffix to each file's top-level `describe` name to satisfy Jasmine's
  duplicate-suite-name guard.

## Implementation Steps

### Step 1 — Create the setup module and the five per-subcommand spec files

Create `core/spec/support/factories/issueStateParitySetup.js` exporting:

- `SHELL_SCRIPT` = `path.join(REPO_ROOT, 'arcanum', '_lib', 'issue_state_shell.sh')` and
  `NATIVE_BIN` (re-exported from `../utils/runCommand.js`); import `REPO_ROOT` and
  `runCommand` from `../utils/runCommand.js` and re-export `runCommand`.
- `createFixtureRepo(prefix)` — `createTempDir(prefix)` then
  `execFileAsync('git', ['init', '--quiet', '-b', 'main', dir])`, returning `dir` (a bare
  string path, matching how the current helpers use `shellRepo` / `nativeRepo`).
- `runBoth(args, shellRepo, nativeRepo)` — same body as today, repos as parameters:
  `runCommand([SHELL_SCRIPT, shellRepo, ...args], shellRepo)` and
  `runCommand([process.execPath, NATIVE_BIN, 'issue-state', nativeRepo, ...args], nativeRepo)`,
  returning `{ shell, native }`.
- `assertStateFilesMatch(id, shellRepo, nativeRepo)` — same body as today, repos as
  parameters; still `expect(nativeContent).toEqual(shellContent)` (support modules already
  use the `expect` global, e.g. `utils/runCommand.js`).

Create `core/spec/bin/issueStateParity/` with five files. Each has `let shellRepo; let nativeRepo;`,
a `beforeEach` calling `createFixtureRepo('arcanum-core-is-parity-shell-' / '-native-')`, an
`afterEach` calling `removeTempDir` on both, and a top-level `describe` named
`'issue-state parity (shell vs. native) — <concern>'`. Every `it` body is copied verbatim
except that `runBoth(...)` / `assertStateFilesMatch(...)` calls gain the trailing
`, shellRepo, nativeRepo` arguments (mechanical, matches the ConfigParity split); assertion
lines are untouched.

| File | `describe` suffix | Inner `describe` blocks (1 `it` each) | Needs from setup module |
|---|---|---|---|
| `get_spec.js` | `— get` | `get on a missing state file`, `get on a missing field`, `get on an existing field` | `runBoth`, `createFixtureRepo` |
| `set_spec.js` | `— set` | `set creating a new field`, `set overwriting an existing field` | `runBoth`, `assertStateFilesMatch`, `createFixtureRepo` |
| `set_json_spec.js` | `— set-json` | `set-json with an object value`, `set-json with an array value` | `runBoth`, `assertStateFilesMatch`, `createFixtureRepo` |
| `append_json_spec.js` | `— append-json` | `append-json on a field that does not exist yet`, `append-json on a field that is already an array` | `runBoth`, `assertStateFilesMatch`, `createFixtureRepo` |
| `argument_validation_spec.js` | `— argument validation` | `missing required args`, `an unknown subcommand`, `a present-but-non-directory repo_path`, `a non-git repo_path` | `runCommand`, `runBoth`, `SHELL_SCRIPT`, `NATIVE_BIN`, `createFixtureRepo` |

`argument_validation_spec.js` also imports `createTempDir` / `removeTempDir` from
`../../support/utils/tempDir.js` and `path` from `node:path` (the `a non-git repo_path` and
`a present-but-non-directory repo_path` cases call `runCommand` directly with
`SHELL_SCRIPT` / `NATIVE_BIN` and build paths with `path.join`). The other four files import
only `removeTempDir` from `../../support/utils/tempDir.js`.

### Step 2 — Delete the monolith and verify

Delete `core/spec/bin/issueStateParity_spec.js`. Run `make core-test` and `make core-lint`
from the repo root:

- total spec count is unchanged (13 `it` blocks, now spread across the five new files);
- lint is clean — watch import ordering and unused imports (e.g. `get_spec.js` must not
  import `assertStateFilesMatch` or `path`).

## Files to Change

- `core/spec/support/factories/issueStateParitySetup.js` — new; shared `runBoth` /
  `assertStateFilesMatch` (repo pair as explicit params), `createFixtureRepo`, and the
  `SHELL_SCRIPT` / `NATIVE_BIN` / `runCommand` re-exports.
- `core/spec/bin/issueStateParity/get_spec.js` — new; the three `get` describes.
- `core/spec/bin/issueStateParity/set_spec.js` — new; the two `set` describes.
- `core/spec/bin/issueStateParity/set_json_spec.js` — new; the two `set-json` describes.
- `core/spec/bin/issueStateParity/append_json_spec.js` — new; the two `append-json` describes.
- `core/spec/bin/issueStateParity/argument_validation_spec.js` — new; the four
  argument / repo-path validation describes.
- `core/spec/bin/issueStateParity_spec.js` — deleted.

## CI Checks

- `core/`: `make core-test` (CI job: `test` — `yarn test`)
- `core/`: `make core-lint` (CI job: `checks` — `yarn lint`)

## Notes

- The issue's "every `it` moves verbatim" holds for the assertions; the `runBoth` /
  `assertStateFilesMatch` call sites necessarily gain `shellRepo, nativeRepo` arguments,
  exactly as the `autoFixAllConfigParity/` split did
  (`runPair('get', shellRepo, nativeRepo, [...])`).
- Concern suffixes on the top-level `describe` names are required — five files sharing
  `'issue-state parity (shell vs. native)'` would trip Jasmine's duplicate-suite-name guard
  (called out in the #356 split).
- `runCommand` is reused from `core/spec/support/utils/runCommand.js` (re-exported from the
  setup module) rather than copied — the inline copy is byte-identical and
  `queueParitySetup.js` already imports it from there. Keeping a local copy (as
  ConfigParity / ReplyComment do) is an acceptable fallback if import-ordering lint proves
  fussy.
- No change to `arcanum/_lib/issue_state_shell.sh` or the native `issue-state` implementation.

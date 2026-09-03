# Node Plan: Split spec ArcanumSplitIssueCreateSubIssueParity

Main plan: [plan.md](plan.md)

## Overview

Spec-only reorganization of `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`
(285 lines, 7 `describe` blocks) into a `arcanumSplitIssueCreateSubIssueParity/` directory
holding two files — `argument_validation_spec.js` (the six argument / file-existence
validation blocks) and `retry_exhausted_spec.js` (the one `max-retry-count: 0` behavioral
block) — plus a shared support module at
`core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`. Every `it`
moves verbatim; no assertion changes; the entrypoint under test
(`arcanum-split-issue/scripts/create_sub_issue_shell.sh`) and the native
`arcanum-split-issue-create-sub-issue` implementation are untouched.

This is the sixth in the parity-monolith split series (#347, #350–#353) and follows the
same conventions those settled: `autoFixAllGithubParity/`'s validation-vs-substantive
directory shape, and `arcanumUpdateRunUpdateParitySetup.js`'s factory shape (helper bodies
verbatim, plumbing constants module-private, no rationale comment in the factory).

## Context

- **File today**: `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`. A ~44-line
  header comment block, then module-private constants (`execFileAsync`, `REPO_ROOT`,
  `SHELL_SCRIPT`, `NATIVE_BIN`, `ISSUE_ID = '999'`), then four local helpers with JSDoc
  (`runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo`), then one top-level
  `describe('arcanum-split-issue-create-sub-issue parity (shell vs. native)', …)` wrapping
  7 child `describe`s.
- **The six validation blocks** — `a missing <repo_path> argument`, `a missing <issue_id>
  argument`, `a missing <sub_issue_file> argument`, `a repo_path that is not a directory`,
  `a repo_path that is not a git repository`, `a sub_issue_file that does not exist` — each
  hold one `it` that calls `runBoth([...], cwd)` and asserts `native.stdout === shell.stdout`,
  `native.code === shell.code`, `shell.code !== 0`, `shell.stdout === ''` (the three
  bad-value blocks additionally assert the exact `shell.stderr` message and that
  `native.stderr` contains it).
- **The one behavioral block** — `the retry-exhausted failure path (plan-issues.max-retry-count: 0)`
  — builds two separate git fixture repos (shell side, native side), seeds each with
  `seedZeroRetryRepo` + a written sub-issue draft, then invokes `runCommand([SHELL_SCRIPT, …])`
  and `runCommand([process.execPath, NATIVE_BIN, …])` **directly** (not `runBoth`, which
  forces one shared cwd/args) and asserts the doubled `STATUS=failed` stdout.
- **Import surface today** (all from `../support/utils/`): `createGitFixtureRepo` from
  `gitFixtureRepo.js`, `seedOriginUrl` from `runCommand.js`, `createTempDir` /
  `removeTempDir` from `tempDir.js`. Of these, only `seedOriginUrl` is used inside a helper
  (`seedZeroRetryRepo`); the rest are used directly in `it` bodies.
- **Lint**: `core/eslint.config.mjs` extends `js.configs.recommended`, so `no-unused-vars`
  is an error — each new file must import exactly what it references, nothing more.
- **Precedent factory**: `core/spec/support/factories/arcanumUpdateRunUpdateParitySetup.js`
  — `execFileAsync` / `REPO_ROOT` stay module-private, `runCommand` and the pair-runner are
  exported, JSDoc kept on every helper, no file-level rationale comment.

## Deviation from the issue's helper-disposition table

The issue's "Extract shared helpers" table lists `SHELL_SCRIPT` and `NATIVE_BIN` as
module-private, reasoning "No spec here invokes a script path directly." That is not true of
`retry_exhausted_spec.js`: its `it` moves **verbatim** and references both `SHELL_SCRIPT` and
`NATIVE_BIN` directly (it cannot use `runBoth` — it needs distinct shell/native repos and
file paths). To keep the `it` verbatim, this plan **exports `SHELL_SCRIPT` and `NATIVE_BIN`**
from the factory. `execFileAsync` and `REPO_ROOT` remain module-private (no spec references
them). The issue's per-file import lists are likewise tightened to only what each file uses,
so `make core-lint` stays clean (see step details).

## Implementation Steps

### Step 1 — Add the shared support factory module

Create `core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`. No
file-level rationale comment (matches `arcanumUpdateRunUpdateParitySetup.js`).

- **Imports**: `execFile` from `node:child_process`; `mkdir`, `writeFile` from
  `node:fs/promises`; `path` from `node:path`; `fileURLToPath` from `node:url`; `promisify`
  from `node:util`; `seedOriginUrl` from `../utils/runCommand.js`.
  (`createGitFixtureRepo`, `createTempDir`, `removeTempDir` are **not** imported here — no
  helper uses them.)
- **Module-private constants**, copied verbatim except `REPO_ROOT`'s depth:
  - `const execFileAsync = promisify(execFile);`
  - `const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');`
    — four `'..'` segments (from `core/spec/support/factories/` to repo root), matching
    `arcanumUpdateRunUpdateParitySetup.js`; the monolith had three because it lived in
    `core/spec/bin/`.
- **Exported constants**:
  - `export const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'create_sub_issue_shell.sh');`
  - `export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');`
  - `export const ISSUE_ID = '999';`
- **Exported helpers**, bodies and JSDoc copied verbatim from the monolith, only prefixing
  each with `export`:
  - `export async function runCommand([file, ...args], cwd) { … }`
  - `export async function runBoth(args, cwd) { … }` (references `SHELL_SCRIPT`, `NATIVE_BIN`,
    `runCommand` — all now module-scoped)
  - `export async function writeSubIssueFile(repoPath, issueId, count, slug, content) { … }`
  - `export async function seedZeroRetryRepo(repoPath) { … }` (references `seedOriginUrl`)

### Step 2 — Add the two spec files and delete the monolith

Create `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`
and `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/retry_exhausted_spec.js`, then
`git rm` the original `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`.

Both new files keep the same outer wrapper
`describe('arcanum-split-issue-create-sub-issue parity (shell vs. native)', () => { … })`
and move their child `describe`s (with every `it` and assertion **verbatim**) into it.

**`argument_validation_spec.js`** — child `describe`s (in original order):
`a missing <repo_path> argument`, `a missing <issue_id> argument`,
`a missing <sub_issue_file> argument`, `a repo_path that is not a directory`,
`a repo_path that is not a git repository`, `a sub_issue_file that does not exist`.

- Imports:
  - `path` from `node:path` (used by the not-a-directory and missing-file blocks)
  - `createGitFixtureRepo` from `../../support/utils/gitFixtureRepo.js`
  - `createTempDir`, `removeTempDir` from `../../support/utils/tempDir.js`
  - `ISSUE_ID`, `runBoth` from
    `../../support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`
  - (No `runCommand` import — none of these six blocks call it directly, contrary to the
    issue's import list; importing it would trip `no-unused-vars`.)
- Header comment: the parity intro block near-verbatim from the monolith (what runs against
  what, byte-identical stdout/exit, the `script-engine.md` / plan `node.md` doc refs),
  ending with the pointer sentence: "…covers the argument / file-existence validation
  scenarios. See `retry_exhausted_spec.js` for the retry-exhausted failure path."
  Then the **coverage note** (why the `STATUS=ok` happy path is not exercised here —
  `spawn_issue.sh` → `curl` can't be intercepted like `gh`; happy path lives in
  `ArcanumSplitIssueCreateSubIssue_spec.js`'s node/03 unit tests), verbatim — this file is
  the suite-wide "what this parity file deliberately omits" note.

**`retry_exhausted_spec.js`** — child `describe`:
`the retry-exhausted failure path (plan-issues.max-retry-count: 0)`, its single `it`
verbatim.

- Imports:
  - `createGitFixtureRepo` from `../../support/utils/gitFixtureRepo.js`
  - `ISSUE_ID`, `NATIVE_BIN`, `SHELL_SCRIPT`, `runCommand`, `seedZeroRetryRepo`,
    `writeSubIssueFile` from
    `../../support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`
  - (No `runBoth` import — the retry `it` calls `runCommand` twice with distinct repos;
    importing `runBoth` would trip `no-unused-vars`. `process.execPath` needs no import.)
- Header comment: the same parity intro block near-verbatim, ending with the reciprocal
  pointer sentence: "…covers the retry-exhausted failure path. See
  `argument_validation_spec.js` for the argument / file-existence validation scenarios."
  Then the **retry-exhausted explanation** from the monolith (setting
  `plan-issues.max-retry-count` to `0` makes both the shell `while` loop and `SpawnIssue.js`'s
  `for` loop skip every attempt offline; `create_sub_issue_shell.sh` prints `STATUS=failed`
  twice on this path), verbatim.

Match the surrounding codebase's import ordering (node builtins first, then `../` utils,
then the factory) when writing each file.

## Files to Change

- `core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js` — **new**;
  shared factory holding `ISSUE_ID`, `SHELL_SCRIPT`, `NATIVE_BIN` (exported) and
  `runCommand`, `runBoth`, `writeSubIssueFile`, `seedZeroRetryRepo` (exported, verbatim
  bodies + JSDoc); `execFileAsync`, `REPO_ROOT` module-private.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js` —
  **new**; the six argument / file-existence validation `describe` blocks, verbatim, plus
  parity-intro + coverage-note headers.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/retry_exhausted_spec.js` — **new**;
  the retry-exhausted `describe` block, verbatim, plus parity-intro + retry-explanation
  headers.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` — **deleted**; content
  fully redistributed above.

## CI Checks

- `core/`: `make core-test` (CI job: `test` — runs `yarn test`). Same total spec count as
  before the split (7 `it`s: 6 in `argument_validation_spec.js`, 1 in
  `retry_exhausted_spec.js`).
- `core/`: `make core-lint` (CI job: `checks` — runs `yarn lint`). Must be clean — in
  particular no `no-unused-vars` from an over-broad import list.

## Notes

- No change to `arcanum-split-issue/scripts/create_sub_issue_shell.sh` or the native
  `arcanum-split-issue-create-sub-issue` implementation — spec-only, per the issue's
  "Out of scope".
- The two new files share the identical outer `describe` string; that is intentional and
  matches the sibling splits (`autoFixAllGithubParity/`, `arcanumUpdateRunUpdateParity/`) —
  the runner reports them as separate files.
- JSDoc is disabled by eslint for `spec/**/*.js` (which includes `spec/support/**`), but the
  helper JSDoc blocks are copied over verbatim anyway to match
  `arcanumUpdateRunUpdateParitySetup.js`.
- The `SHELL_SCRIPT` / `NATIVE_BIN` export decision and the trimmed import lists are
  deliberate corrections to the issue text (see "Deviation from the issue's
  helper-disposition table"); flag in the PR description so review isn't surprised.

# node Plan: Split spec ArcanumSplitIssueCreateSubIssueFileParity

Main plan: [plan.md](plan.md)

## Overview

Reorganize the `arcanum-split-issue-create-sub-issue-file` shell-vs-native parity suite from
one 264-line file into a two-file directory plus a shared support module. Pure test
navigability change — no assertion, no coverage, and no production-code change. Every `it`
moves byte-for-byte.

## Context

`core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` currently holds:

- **Module-level setup** (lines 1–64): imports; `execFileAsync`; the constants `REPO_ROOT`,
  `SHELL_SCRIPT`, `NATIVE_BIN`; and the local helpers `runCommand([file, ...args], cwd)` and
  `runBoth(args, cwd)`.
- **One top-level `describe`** — `'arcanum-split-issue-create-sub-issue-file parity (shell vs.
  native)'` — wrapping 8 child `describe` blocks:

  | Child `describe` | `it` count | Helpers used |
  |---|---|---|
  | `a missing <repo_path> argument` | 1 | `runBoth`, `createTempDir`/`removeTempDir` |
  | `a missing <issue_id> argument` | 1 | `runBoth`, `createGitFixtureRepo` |
  | `a missing <title> argument` | 1 | `runBoth`, `createGitFixtureRepo` |
  | `a missing <body_file> argument` | 1 | `runBoth`, `createGitFixtureRepo` |
  | `a repo_path that is not a directory` | 1 | `runBoth`, `createTempDir`/`removeTempDir`, `path` |
  | `a repo_path that is not a git repository` | 1 | `runBoth`, `createTempDir`/`removeTempDir` |
  | `a body_file that does not exist` | 1 | `runBoth`, `createGitFixtureRepo`, `path` |
  | `the success path` | 2 | `runBoth`, `runCommand`, `SHELL_SCRIPT`, `NATIVE_BIN`, `createGitFixtureRepo`, `path`, `readFile`/`writeFile`/`mkdir` |

  Total: **9 `it` blocks**.

The immediately-preceding sibling splits (`issueStateParity/` + `issueStateParitySetup.js`
from #357; `arcanumSplitIssueCreateSubIssueParity/` +
`arcanumSplitIssueCreateSubIssueParitySetup.js` from #354) establish the exact convention to
follow:

- Split spec files live in `core/spec/bin/<Name>Parity/*.js`.
- The shared module is `core/spec/support/factories/<Name>ParitySetup.js` and exports both the
  run helpers and the `SHELL_SCRIPT` / `NATIVE_BIN` constants (the `success path`'s second
  `it` references those constants directly, not through `runBoth`).
- The original monolith `<Name>Parity_spec.js` is deleted in the same change.

Note: the current file uses the bare string literal `'999'` for the issue id throughout — do
**not** introduce an `ISSUE_ID` constant; keep the literals exactly as they appear so every
`it` stays verbatim.

## Implementation Steps

### Step 1 — Extract the shared support module

Create `core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js`
containing, copied verbatim from the monolith's lines 1–64 (adjusting only the relative-path
depth for the new location):

- `import { execFile } from 'node:child_process';`
- `import path from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { promisify } from 'node:util';`
- `const execFileAsync = promisify(execFile);`
- `REPO_ROOT` — from `support/factories/` the repo root is **four** `..` levels up:
  `path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')`
  (the monolith at `bin/` used three; the sibling
  `arcanumSplitIssueCreateSubIssueParitySetup.js` is the reference for the four-level form).
- `SHELL_SCRIPT` = `path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts',
  'create_sub_issue_file_shell.sh')` — **exported**.
- `NATIVE_BIN` = `path.join(REPO_ROOT, 'core', 'bin', 'arcanum')` — **exported**.
- `runCommand([file, ...args], cwd)` — **exported**, body unchanged (keep the JSDoc).
- `runBoth(args, cwd)` — **exported**, body unchanged including the literal subcommand string
  `'arcanum-split-issue-create-sub-issue-file'` (keep the JSDoc).

`REPO_ROOT` itself need not be exported (neither spec file references it directly); export
`SHELL_SCRIPT`, `NATIVE_BIN`, `runCommand`, `runBoth`. Match the sibling module's ESLint style
(blank line before `return`, JSDoc blocks retained) so `yarn lint` stays clean.

### Step 2 — Create the two split spec files and delete the monolith

Create `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js`:

- Header comment: adapt the monolith's lines 9–20 block (parity test for the
  `arcanum-split-issue-create-sub-issue-file` migrated entrypoint, issue #257; the
  script-engine.md "output/exit-code contract" reference; the "runs
  `create_sub_issue_file_shell.sh` directly, NOT through the `create_sub_issue_file.sh`
  engine_dispatch shim" note; "purely filesystem-based — no `gh`/network dependency"). Add one
  line: *"This file covers the argument / file-existence validation scenarios. See
  `success_path_spec.js` for the file-creation success path."*
- Imports: `path` from `node:path`; `createGitFixtureRepo` from
  `../../support/utils/gitFixtureRepo.js`; `createTempDir, removeTempDir` from
  `../../support/utils/tempDir.js`; `runBoth` from
  `../../support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js`.
- Top-level `describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native)',
  () => { ... })` wrapping the **seven** validation child `describe` blocks (monolith lines
  67–197), moved verbatim.

Create `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/success_path_spec.js`:

- Header comment: same adapted block, with the cross-reference line pointing the other way:
  *"This file covers the file-creation success path. See `argument_validation_spec.js` for the
  argument / file-existence validation scenarios."*
- Imports: `mkdir, readFile, writeFile` from `node:fs/promises`; `path` from `node:path`;
  `createGitFixtureRepo` from `../../support/utils/gitFixtureRepo.js`;
  `runBoth, runCommand, SHELL_SCRIPT, NATIVE_BIN` from
  `../../support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js`.
- Top-level `describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native)',
  () => { ... })` wrapping the single `describe('the success path', ...)` block with **both**
  its `it` blocks (monolith lines 199–263), moved verbatim.

Delete `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js`.

Verify no other file imports from the deleted monolith (it exported nothing, so this is
expected to be a no-op check): `grep -rn "arcanumSplitIssueCreateSubIssueFileParity_spec" core/`.

## Files to Change

- `core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js` — **new**;
  shared module exporting `SHELL_SCRIPT`, `NATIVE_BIN`, `runCommand`, `runBoth`, copied
  verbatim from the monolith with the relative-path depth adjusted for `support/factories/`.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js` —
  **new**; the seven validation `describe` blocks, verbatim, importing `runBoth` from the
  shared module.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/success_path_spec.js` — **new**;
  the `the success path` block with both `it`s, verbatim, importing `runBoth`, `runCommand`,
  `SHELL_SCRIPT`, `NATIVE_BIN` from the shared module.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` — **deleted**; content
  fully relocated to the two files above.

## CI Checks

- `core/`: `make core-test` — runs `yarn test` (CI job: `test`). Must pass with the **same
  total spec count** as before the change (9 `it` blocks, just redistributed).
- `core/`: `make core-lint` — runs `yarn lint` (CI job: `checks`). Must be clean, including
  the new support module and the two new spec files.

## Notes

- Zero production-code change: `arcanum-split-issue/scripts/create_sub_issue_file_shell.sh`
  and the native `arcanum-split-issue-create-sub-issue-file` implementation are untouched and
  out of scope.
- The `success path`'s second `it` (monolith lines 234–262) builds its command arrays inline
  from `SHELL_SCRIPT` / `NATIVE_BIN` rather than calling `runBoth`; this is why the shared
  module must export those two constants, not just the helpers.
- Keep the `'999'` id string literals exactly as-is — no `ISSUE_ID` constant — so the moved
  `it` blocks remain byte-identical.
- Both new spec files re-declare the same top-level
  `describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native)')` wrapper;
  this matches the sibling `arcanumSplitIssueCreateSubIssueParity/` split, where each file
  repeats the parent `describe`.
- Relative import depth increases by one segment (`../../support/...`) because the specs now
  sit one directory deeper than the old monolith.

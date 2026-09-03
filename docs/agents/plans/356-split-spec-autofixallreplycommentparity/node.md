# Node Plan: Split spec AutoFixAllReplyCommentParity

Main plan: [plan.md](plan.md)

## Overview

Break the monolithic `core/spec/bin/autoFixAllReplyCommentParity_spec.js` into a
`core/spec/bin/autoFixAllReplyCommentParity/` directory of three concern-scoped spec files,
and move the shared local helpers (`runCommand`, `git`, `seedGithubLikeRepo`) plus the
module-level constants they depend on into a new support module
`core/spec/support/factories/autoFixAllReplyCommentParitySetup.js`. This mirrors the
already-merged `autoFixAllConfigParity/` + `autoFixAllConfigParitySetup.js` and
`autoFixAllCheckoutFromMainParity/` splits (issues #355, #352). Pure navigability change —
no production code is touched, every `it` moves verbatim, no assertion changes.

## Context

The current file has these six top-level `describe` blocks, each containing exactly one
`it`:

| `describe` block | Network touchpoints |
|---|---|
| `a missing required argument` | none (temp dir only) |
| `a present-but-non-directory repo_path (hard failure)` | none (temp dir only) |
| `a non-git repo_path (hard failure)` | none (temp dir only) |
| `no pull request found for the current branch` | fake `gh` on `PATH`, git-fixture repos |
| `the REST call to post the comment fails` | fake `gh` + fake `fetch` preload, git-fixture repos |
| `the happy path` | fake `gh` + fake `fetch` preload, git-fixture repos |

Shared local helpers defined above the top `describe` (all copied verbatim into the new
support module):

- `execFileAsync` — `promisify(execFile)`.
- `runCommand([file, ...args], cwd, env)` — runs a shell/native invocation, returns
  `{ stdout, stderr, code }`.
- `git(args, cwd)` — thin `execFileAsync('git', ...)` wrapper.
- `seedGithubLikeRepo(repo)` — sets a github.com-shaped `origin` URL and a
  `url.<localBare>.pushInsteadOf` redirect (via `seedOriginUrl` from
  `../support/utils/runCommand.js`).

Module-level constants the helpers/specs depend on:

- `REPO_ROOT` — `path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')`.
  In the support module (one directory deeper, at `core/spec/support/factories/`) this
  becomes `'..', '..', '..', '..'` — or import the existing `REPO_ROOT` from
  `../utils/runCommand.js`, as `autoFixAllConfigParitySetup.js` does.
- `SHELL_SCRIPT` — `<REPO_ROOT>/auto-fix-all/scripts/reply_comment_shell.sh`.
- `NATIVE_BIN` — `<REPO_ROOT>/core/bin/arcanum`.
- `FAKE_FETCH_PRELOAD` — `pathToFileURL(<REPO_ROOT>/core/spec/support/utils/fakeGithubApiFetchPreload.js).href`.
- `ID` — `'999'`.
- `ARGS_TAIL` — `[ID, 'node', 'Node Agent', 'node@example.com', 'a reply']`.

Existing `../support/utils/` imports currently in the spec, needed by the extracted code:
`createFakeGhBin` (`fakeGhBin.js`), `createGitFixtureRepo` (`gitFixtureRepo.js`),
`seedOriginUrl` (and possibly `REPO_ROOT`) (`runCommand.js`), `createTempDir` /
`removeTempDir` (`tempDir.js`). Node built-ins used: `execFile`, `path`,
`fileURLToPath` / `pathToFileURL`, `promisify`.

The large explanatory header comment (issue #256 context, the "none of this touches the
real network" rundown) belongs on the shared support module; each spec file gets a short
one-line header pointing at it.

## Implementation Steps

### Step 1 — Create the shared support module

Create `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js`:

- Move the header comment block and the helper definitions (`runCommand`, `git`,
  `seedGithubLikeRepo`) verbatim.
- Export everything the three spec files need: the helpers, plus the constants
  `SHELL_SCRIPT`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD`, `ID`, `ARGS_TAIL`, and re-export the
  `../support/utils/` symbols the specs consume (`createFakeGhBin`, `createGitFixtureRepo`,
  `createTempDir`, `removeTempDir`) so each spec has a single import line — follow whatever
  re-export vs. direct-import shape `autoFixAllConfigParitySetup.js` uses for consistency.
- Path depth: this module sits at `core/spec/support/factories/`, so relative paths to
  `../support/utils/*` become `../utils/*`, and a hand-rolled `REPO_ROOT` needs one more
  `'..'` — prefer importing `REPO_ROOT` from `../utils/runCommand.js` like the sibling
  setup module does.
- Keep JSDoc on the moved helpers.

### Step 2 — Create the three split spec files and delete the monolith

Create directory `core/spec/bin/autoFixAllReplyCommentParity/` with:

- `preconditions_spec.js` — the `describe` blocks `a missing required argument`,
  `a present-but-non-directory repo_path (hard failure)`, `a non-git repo_path (hard
  failure)`, and `no pull request found for the current branch`, each with its single `it`
  verbatim. Imports from `../../support/factories/autoFixAllReplyCommentParitySetup.js`
  (note the extra `../` — spec files here are one level deeper than the old
  `core/spec/bin/` file) plus `path` for the non-directory case.
- `rest_failure_spec.js` — the `describe` block `the REST call to post the comment fails`,
  its single `it` verbatim.
- `happy_path_spec.js` — the `describe` block `the happy path`, its single `it` verbatim.

Each file keeps its own top-level `describe('auto-fix-all-reply-comment parity (shell vs.
native)', ...)` wrapper so test names are unchanged, and opens with a one-line comment
pointing at the support module for the full context.

Delete `core/spec/bin/autoFixAllReplyCommentParity_spec.js`.

## Files to Change

- `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js` — **new**; header
  comment + `runCommand` / `git` / `seedGithubLikeRepo` helpers + shared constants, all
  moved verbatim and exported.
- `core/spec/bin/autoFixAllReplyCommentParity/preconditions_spec.js` — **new**; 4
  `describe` blocks (3 validation hard-failures + "no pull request found"), each with its
  single `it` verbatim.
- `core/spec/bin/autoFixAllReplyCommentParity/rest_failure_spec.js` — **new**; the "REST
  call to post the comment fails" `describe` + `it` verbatim.
- `core/spec/bin/autoFixAllReplyCommentParity/happy_path_spec.js` — **new**; the "happy
  path" `describe` + `it` verbatim.
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` — **deleted**.

## CI Checks

- `core/`: `make core-test` (CI job: `test` — runs `yarn test` in `core/`)
- `core/`: `make core-lint` (CI job: `checks` — runs `yarn lint` in `core/`)

Total spec count must be unchanged (6 `it` blocks before and after).

## Notes

- No changes to `auto-fix-all/scripts/reply_comment_shell.sh`, `reply_comment.sh`, or the
  native `AutoFixAllReplyComment.js` / `auto-fix-all-reply-comment` implementation.
- Watch the relative-path depth shift: spec files move from `core/spec/bin/` to
  `core/spec/bin/autoFixAllReplyCommentParity/` (one level deeper → `../../support/...`),
  and the support module lives at `core/spec/support/factories/` (→ `../utils/...`).
- If the project's lint config forbids unused re-exports or enforces an import style,
  match `autoFixAllConfigParitySetup.js` exactly rather than inventing a new convention.
- `preconditions_spec.js` bundles the only pure-offline cases plus the offline-ish "no PR
  found" case (fake `gh`, no `fetch`), leaving `rest_failure_spec.js` and
  `happy_path_spec.js` as the two that exercise the fake `fetch` preload — matching the
  split axis in the issue.

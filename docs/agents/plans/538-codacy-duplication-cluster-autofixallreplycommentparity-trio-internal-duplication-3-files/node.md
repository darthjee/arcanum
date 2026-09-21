# Node Plan: Codacy: duplication cluster — autoFixAllReplyCommentParity trio internal duplication (3 files)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add a shared parity-fixture helper
Add a new exported async function (e.g. `runReplyCommentParityCase`) to `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js` that wraps the lifecycle currently duplicated across the three specs:

- create a fake `gh` binary (`createFakeGhBin()`) and two git fixture repos (`createGitFixtureRepo()`, one for the shell run and one for the native run)
- seed both as GitHub-like (`seedGithubLikeRepo`)
- build the shared `env` (`PATH` prefixed with `fakeGh.binDir`, merged with an `extraEnv` parameter) — `rest_failure_spec.js`/`happy_path_spec.js` need extra keys (`FAKE_GH_PR_NUMBER`, `FAKE_GH_COMMENT_FAIL`, `ARCANUM_TEST_FAKE_FETCH`); the `preconditions_spec.js` "no pull request found" case needs none
- run the shell command (`runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env)`) and the native command — the native command line must optionally include `process.execPath, '--import', FAKE_FETCH_PRELOAD` ahead of `NATIVE_BIN` depending on a boolean parameter (e.g. `useFakeFetchPreload`), since only the REST-failure and happy-path cases touch the native `fetch` call
- assert the shared parity checks (`native.stdout` equals `shell.stdout`, `native.code` equals `shell.code`) unconditionally, then hand off to a caller-supplied `assert({ shell, native })` callback for the case-specific assertions (empty stdout vs. specific content, non-zero exit vs. exit 0)
- clean up all three fixtures (`shellRepo.cleanup()`, `nativeRepo.cleanup()`, `fakeGh.cleanup()`) in a `finally` block, exactly as today

Keep this helper name and shape distinct from any argument-validation helper used for the sibling "missing required argument" duplication cluster (out of scope here — see the issue's Context).

### Step 2 — Use the helper in all three specs
Replace the duplicated blocks with calls to the new helper:

- `preconditions_spec.js`: only the `'no pull request found for the current branch'` test (lines 85-111) changes — no `extraEnv`, no fetch preload, `assert` checks `expect(shell.stdout).toEqual('')`. The other three tests in this file (missing argument, non-directory repo_path, non-git repo_path) are a different pattern (no `fakeGh`/fixture repos) and are out of scope.
- `rest_failure_spec.js`: `extraEnv` includes `FAKE_GH_PR_NUMBER: '42'`, `FAKE_GH_COMMENT_FAIL: '1'`, `ARCANUM_TEST_FAKE_FETCH: 'failure'`; `useFakeFetchPreload: true`; `assert` checks `expect(shell.stdout).toEqual('')`.
- `happy_path_spec.js`: `extraEnv` includes `FAKE_GH_PR_NUMBER: '42'`, `ARCANUM_TEST_FAKE_FETCH: 'success'`; `useFakeFetchPreload: true`; `assert` checks `expect(shell.code).toEqual(0)` and `expect(shell.stdout).toContain('set up to track')`.

Run `yarn test` (see CI Checks below) after each file's change to confirm parity assertions and coverage are unchanged.

## Files to Change
- `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js` — add the shared `runReplyCommentParityCase` (or similarly named) helper.
- `core/spec/bin/autoFixAllReplyCommentParity/preconditions_spec.js` — replace the "no pull request found" block's duplicated setup/teardown with a call to the helper.
- `core/spec/bin/autoFixAllReplyCommentParity/rest_failure_spec.js` — replace the duplicated setup/teardown with a call to the helper.
- `core/spec/bin/autoFixAllReplyCommentParity/happy_path_spec.js` — replace the duplicated setup/teardown with a call to the helper.

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- Naming of the helper is left to implementation (e.g. `runReplyCommentParityCase`); avoid the originally proposed `replyCommentRestFixture` name since one of the three duplicated blocks isn't a REST scenario.
- Precedent: issue #536 (`autoMonitorPrMonitorPrParity` fixture family) extracted an analogous `itMatchesShellForState` helper for the same kind of shell/native fixture-lifecycle duplication — follow a similar parameterization style where it fits.

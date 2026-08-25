# Issue: Split autoFixAllQueueParity_spec.js into per-subcommand files

## Description

Follow-up from #288 ("Refactor autoFixAllGithubParity_spec"), which established a new convention: specs with 400+ lines AND multiple contexts/methods under test should be split into a subdirectory of one file per subcommand, with shared helpers extracted to `core/spec/support/`.

`core/spec/bin/autoFixAllQueueParity_spec.js` is 479 lines and already meets that threshold — it tests 7 subcommands of `auto-fix-all-queue-*` across 7 `describe` blocks and 14 test cases (`next`, `wait-next`, `pop`, `empty`, `list`, `save`, `push`). It wasn't included in #288's scope, kept deliberately narrow to `autoFixAllGithubParity_spec.js` alone.

## Solution

Apply the same convention established in #288 to this file:

- Split into `core/spec/bin/autoFixAllQueueParity/` with one file per subcommand (`next_spec.js`, `wait_next_spec.js`, `pop_spec.js`, `empty_spec.js`, `list_spec.js`, `save_spec.js`, `push_spec.js`).
- Reuse the shared helpers #288 already landed in `core/spec/support/` (`core/spec/support/factories/githubParitySetup.js`, `core/spec/support/utils/runCommand.js`) rather than re-inventing them.
- Zero behavior change to assertions/coverage: same 14 test cases, same assertions.

### Shared Helper Design

`autoFixAllQueueParity_spec.js`'s local `runCommand`/`git` helpers are both deleted in favor of the shared `core/spec/support/utils/runCommand.js` imports. `runCommand` is near-identical already; `git` is not quite byte-identical — the shared `git` additionally sets `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` env vars that the queue spec's local version doesn't set today. This is adopted as-is: the added env vars only make commit authorship deterministic and don't affect any assertion, so no test changes are needed.

The rest needs a queue-specific shape, since queue's entrypoint is structurally different from `auto-fix-all-github`'s (one shell script *per subcommand*, e.g. `queue_next_shell.sh`, vs. github's single `github.sh <subcommand>` dispatcher; and only `save`/`push` use git fixtures, vs. github's fixtures which are always git repos).

- **New `core/spec/support/factories/queueParitySetup.js`** (mirrors `githubParitySetup.js`), holding: the `SHELL_SCRIPTS`/`NATIVE_COMMANDS` maps, `seedQueue`, `seedGithubLikeRepo` (queue's own fixture URL, calling the new shared `seedOriginUrl` below), and `runPair` — the queue equivalent of `runBoth`, needed because `runBoth` hardcodes the single-dispatcher-script convention and can't be reused as-is. Its `setupParityTest`-style factory must be its own, separate from `githubParitySetup.js`'s: that one's `seedEnv` hardcodes `ARCANUM_TEST_FAKE_FETCH: 'github'`, whereas queue's fake-fetch mode is `'queue'`.
- **`core/spec/support/utils/runCommand.js`** gains:
  - `REPO_ROOT` exported (currently a private, unexported constant; `queueParitySetup.js`'s `SHELL_SCRIPTS` map needs it too — no point recomputing the relative path climb).
  - `expectParity` relocated here from `githubParitySetup.js` (where it's currently defined and exported) — it's fully generic (just compares stdout/code), and the queue spec currently repeats the same two `expect()` lines inline 6+ times instead of using it. The 8 existing `core/spec/bin/autoFixAllGithubParity/*.js` files' imports of `expectParity` get updated to pull from `runCommand.js` directly; `githubParitySetup.js` no longer defines or re-exports it.
  - A new `seedOriginUrl(repo, url)` — `git remote set-url origin <url>`, the part every one of these origin-seeding helpers across the parity-spec family actually shares. That rewrite is independently duplicated in 8 places today:
    - A function literally named `seedGithubLikeRepo`, in 5 files differing only in its fixture URL constant except one: `githubParitySetup.js`, `autoFixAllQueueParity_spec.js`, `autoFixAllWaitCiAndMergeParity_spec.js`, `autoFixAllWaitCiParity_spec.js`, and `autoFixAllReplyCommentParity_spec.js` (which also does a `pushInsteadOf` transport rewrite and seeds a template file beyond the origin line).
    - 3 more files with differently-named helpers doing the same underlying rewrite bundled with other setup: `githubIssueInfoParity_spec.js`'s `setOrigin(repoPath, url)`, and `arcanumSplitIssueCreateSubIssueParity_spec.js`/`arcanumSplitIssuePushSubIssuesParity_spec.js`'s respective `seedZeroRetryRepo(repoPath)` (which also configures retry-count).

    This issue migrates all 8 to call `seedOriginUrl` for the origin-URL line: the 4 identical-shape `seedGithubLikeRepo` copies become one-line wrappers around it with their own URL constant; `autoFixAllReplyCommentParity_spec.js`'s `seedGithubLikeRepo`, `githubIssueInfoParity_spec.js`'s `setOrigin`, and the two `seedZeroRetryRepo`s all call it too, then layer their own extra steps on top as before, unchanged in name/shape otherwise. This widens the diff beyond the queue split itself, but removes the duplicated `git remote set-url origin` line everywhere it exists rather than adding a 6th (or 9th) near-duplicate.

Each new `core/spec/bin/autoFixAllQueueParity/<subcommand>_spec.js` imports `runPair`/`seedQueue`/`seedGithubLikeRepo` from `queueParitySetup.js`, `expectParity` from `runCommand.js`, and whichever fixture utils it needs (`createTempDir`/`removeTempDir` for the 5 plain-fs subcommands; `createFakeGhBin`/`createGitFixtureRepo` for `save`/`push`).

### Test Structure Convention

The current file uses `describe`-level `beforeEach`/`afterEach` throughout (each of the 7 blocks has its own, creating/tearing down temp dirs or git fixture repos). #288's split files never use Jasmine hooks — every `it` builds and tears down its own fixtures inline via `try`/`finally`, even when two `it`s in the same file share identical setup.

The queue split follows that convention exactly, dropping `beforeEach`/`afterEach` in all 7 new files:

- **`save`/`push`** (3 `it`s each, currently sharing identical `beforeEach` setup: `createFakeGhBin()` + two `createGitFixtureRepo()` + `seedGithubLikeRepo()` on both) — `queueParitySetup.js` gains a `setupParityTest`-style factory bundling that into one call, so going inline doesn't literally duplicate the setup across each subcommand's `it`s. `push`'s extra `seedQueue(['existing'])` step is called separately, right after the factory call, in each of its `it`s.
- **`next`/`wait-next`/`pop`/`empty`/`list`** (2/1/1/2/2 `it`s respectively) — setup is already just two `createTempDir` calls; inline `try`/`finally` with no factory needed, mirroring `cleanup_branch_spec.js`/`engine_dispatch_spec.js`.

## Expected Behavior

- No spec file in this group exceeds ~150 lines.
- Consistent with the subdirectory convention #288 establishes.
- All 14 existing test cases still pass with identical assertions — behavior-preserving aside from the adopted shared `git` helper's deterministic commit-author env vars, which no assertion depends on.

## Benefits

- Collapses 8 independent origin-seeding helper copies down to one shared `seedOriginUrl` implementation.
- Makes the queue parity spec navigable per-subcommand, matching the github family #288 already split.

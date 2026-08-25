# Split autoFixAllQueueParity_spec.js into per-subcommand files

Delete `core/spec/bin/autoFixAllQueueParity_spec.js` and create `core/spec/bin/autoFixAllQueueParity/` with one file per subcommand, each importing from `queueParitySetup.js` (step 05) and `runCommand.js` (`expectParity`) instead of redefining anything locally. No `describe`-level `beforeEach`/`afterEach` in any of the 7 — every `it` builds and tears down its own fixtures inline via `try`/`finally`, per #288's convention (see `core/spec/bin/autoFixAllGithubParity/cleanup_branch_spec.js` for the plain-fixture shape, `has_shipit_label_spec.js` for the factory-based shape).

Carry over the original file's header comment (lines 10–45 today), splitting its content: the shared parts (issue #264 reference, the shell-vs-native/fixture-doubling explanation) go in each file's own trimmed header, scoped to what's relevant to that subcommand (e.g. only `save`/`push`'s files need the `gh`/`fetch`-doubling paragraph; only `wait-next`'s file needs the "polls forever" paragraph).

- **`next_spec.js`** (2 `it`s) — `describe('auto-fix-all-queue-* parity (shell vs. native) — next', ...)`. Each `it`: `createTempDir`/`createTempDir` inline, `try { ...seedQueue, runPair('next', ...), expectParity(shell, native), plus the extra shell.code/shell.stdout assertions... } finally { removeTempDir both }`. Port both existing `it` bodies (non-empty queue; absent queue file) verbatim, replacing the inline `expect(native.stdout).toEqual(shell.stdout); expect(native.code).toEqual(shell.code);` pair with `expectParity(shell, native)`.
- **`wait_next_spec.js`** (1 `it`) — same shape, `wait-next` subcommand. Keep the original file's "polls forever... every scenario below seeds the queue non-empty up front" explanation in this file's header, since it no longer applies to the other 4 plain-fs files.
- **`pop_spec.js`** (1 `it`) — same shape. This `it` calls `runPair` a second time (for `next`) mid-test to verify the pop actually removed the head — port that follow-up call as-is.
- **`empty_spec.js`** (2 `it`s) — same shape (zero-length queue → exit 0; non-empty queue → exit 1).
- **`list_spec.js`** (2 `it`s) — same shape (non-empty queue; zero-length queue → `"(empty)\n"`).
- **`save_spec.js`** (3 `it`s) — uses `setupParityTest()` from `queueParitySetup.js` inline in each `it` (no `beforeEach`), `try { ...runPair('save', ctx.shellRepo.repoPath, ctx.nativeRepo.repoPath, ids, { env, fakeFetch: true })... } finally { await ctx.cleanup(); }`. Port all 3 `it` bodies (no ids → rejects; successful save with label mutation; save when label mutation fails best-effort) verbatim, replacing the inline parity `expect()` pair with `expectParity`.
- **`push_spec.js`** (3 `it`s) — same `setupParityTest()` factory call, but each `it` additionally calls `seedQueue(ctx.shellRepo.repoPath, ['existing'])`/`seedQueue(ctx.nativeRepo.repoPath, ['existing'])` right after building `ctx` (this was the shared `beforeEach`'s extra step beyond `save`'s). Port all 3 `it` bodies (no ids → rejects; successful push appending to existing queue, including its extra `list` follow-up call; push when the update call fails best-effort) verbatim.

Every file imports `expectParity` from `'../../support/utils/runCommand.js'`, and whichever of `runPair`/`seedQueue`/`seedGithubLikeRepo`/`setupParityTest` it needs from `'../../support/factories/queueParitySetup.js'` — `seedGithubLikeRepo` itself is never imported directly by the split files (only `setupParityTest`, which calls it internally), matching how the github family's split files only import `setupParityTest`, not `seedGithubLikeRepo`, except where a file needs the finer-grained control (like `add_tag_spec.js` does) — none of the 7 queue files need that, so `seedGithubLikeRepo` stays unexported-from-usage (still exported from `queueParitySetup.js` itself, for `setupParityTest` to use internally and for symmetry with `githubParitySetup.js`'s shape).

`next`/`wait-next`/`pop`/`empty`/`list` additionally import `createTempDir`/`removeTempDir` from `'../../support/utils/tempDir.js'`; `save`/`push` don't need fixture-repo imports directly (that's inside `setupParityTest` now).

## Files to Change

- `core/spec/bin/autoFixAllQueueParity_spec.js` — delete.
- `core/spec/bin/autoFixAllQueueParity/next_spec.js` (new) — `next` subcommand, 2 `it`s.
- `core/spec/bin/autoFixAllQueueParity/wait_next_spec.js` (new) — `wait-next` subcommand, 1 `it`.
- `core/spec/bin/autoFixAllQueueParity/pop_spec.js` (new) — `pop` subcommand, 1 `it`.
- `core/spec/bin/autoFixAllQueueParity/empty_spec.js` (new) — `empty` subcommand, 2 `it`s.
- `core/spec/bin/autoFixAllQueueParity/list_spec.js` (new) — `list` subcommand, 2 `it`s.
- `core/spec/bin/autoFixAllQueueParity/save_spec.js` (new) — `save` subcommand, 3 `it`s.
- `core/spec/bin/autoFixAllQueueParity/push_spec.js` (new) — `push` subcommand, 3 `it`s.

## Notes

- After this step, verify with `grep -rn "seedGithubLikeRepo\|SHELL_SCRIPTS\|NATIVE_COMMANDS" core/spec/bin/autoFixAllQueueParity_spec.js` returning nothing (file gone) and `yarn test` still reporting 14 passing specs in this area (same count, now spread across 7 files instead of 1).

# Update AutoFixAllQueue's IssueTagger wiring

`AutoFixAllQueue.js` currently default-constructs one shared `issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs })`, and its `save(repoPath, ...ids)`/`push(repoPath, ...ids)` methods call `this._issueTagger.markEnqueued(repoPath, ids)` — after their own `process.stdout.write('Queue saved: ...')`/`'Pushed: ...')` line, per the existing doc comment's ordering requirement (the confirmation line must print before any `DispatchFailure` from a failed origin/token resolution).

After [Step 02](02-convert-issuetagger.md), `markEnqueued(ids)` drops `repoPath` and expects `IssueTagger` to already be bound to a `RepoContext`. Update:

- Drop the constructor-level `issueTagger` default; add a private `_issueTagger(repoPath)` helper mirroring `AutoFixAllGithub#_prOperations(repoPath)` — builds a per-call `RepoContext` (from the shared `origin`/`githubToken`/`fetchFn`/`timeoutMs`) plus a fresh `IssueTagger({ context, issueClient })`.
- `save`/`push`: replace `await this._issueTagger.markEnqueued(repoPath, ids)` with `await this._issueTagger(repoPath).markEnqueued(ids)`. Building the `RepoContext` itself is synchronous and doesn't resolve `origin`/`token` — the actual resolution (and thus the point a failure can occur) still happens inside `markEnqueued`, after the stdout confirmation line has already been written, so the existing ordering/`DispatchFailure` behavior is unaffected by moving the context-building call earlier.
- Keep the constructor's `issueTagger` deps option for test overrides, but as a per-call builder override (a factory), not a pre-built instance — mirror however [Step 04](04-update-autofixallgithub-issuetagger-wiring.md) exposes `AutoFixAllGithub`'s equivalent override, for consistency between the two.

## Files to Change

- `core/lib/commands/AutoFixAllQueue.js` — replace the constructor-level `issueTagger` singleton with a per-call `_issueTagger(repoPath)` builder; update `save`/`push`'s `markEnqueued` call sites.
- `core/spec/commands/AutoFixAllQueue_spec.js` — update mocks for the per-call `issueTagger` construction; assertions on `save`/`push`'s stdout ordering and `DispatchFailure` behavior should need no changes.

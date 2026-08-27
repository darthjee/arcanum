# Convert IssueTagger to RepoContext-bound

Convert `IssueTagger` (`core/lib/utils/issue/IssueTagger.js`) to the `RepoContext`-bound DI pattern, matching `PrOperations`'s own conversion (plan #292/#294): constructor takes `context`/`issueClient` (default `new IssueClient({ context })`) instead of `origin`/`githubToken`/`fetchFn`/`timeoutMs`; every method drops its `repo`/`repoRef`/`token` parameters, resolving them via `this._context` instead (`resolveWithRef()`/`getToken()`, same as `GitHubClient`).

Concretely:
- `fetchLabels(id, repo, token)` → `fetchLabels(id)`, delegating to `this._issueClient.getIssue(id)` and mapping `.labels`.
- `addLabel(id, repo, token, label)` → `addLabel(id, label)`, delegating to `this._issueClient.addLabel(id, label)`.
- `removeLabel(id, repo, token, label)` → `removeLabel(id, label)`, delegating to `this._issueClient.removeLabel(id, label)`.
- `hasLabel(id, repo, token, label)` → `hasLabel(id, label)` (unchanged logic, just fewer params, reusing the trimmed `fetchLabels`).
- `mutateTag(id, repo, repoRef, token, action, tag)` → `mutateTag(id, repoRef, action, tag)` — `repoRef` is still needed for its own stdout/stderr message text (not a REST param), keep it; `repo`/`token` drop since the client resolves them itself. `repoRef` becomes a plain argument the caller passes in (it's message text, not resolvable via `this._context` alone without an extra call) — or resolve it internally via `this._context.resolveWithRef()` if that reads cleaner; either way, no behavior change.
- `markEnqueued(repoPath, ids)` → `markEnqueued(ids)`. `IssueTagger#markEnqueued` has exactly one caller in the whole codebase (`AutoFixAllQueue.js`, twice), always with a single `repoPath` already known at the call site — so, unlike `GithubIssue`, there's no reason for `IssueTagger` itself to keep a repoPath-per-call entrypoint. Make it fully context-bound like every other method; `AutoFixAllQueue` becomes responsible for building the per-call context before calling it (see [Step 05](05-update-autofixallqueue-issuetagger-wiring.md)). Its existing `DispatchFailure('', 1)` behavior on a failed origin/token resolution must be preserved unchanged — `RepoContext` construction itself is synchronous/non-resolving, so building the context earlier (in the caller) doesn't change *when* the actual origin/token resolution (and thus the possible failure) happens, only *where* the context object is built.

Preserve every stdout/stderr message and the `DispatchFailure` exit-code-1 behavior exactly as documented in the current file's doc comments — this is a pure layering refactor, not a behavior change.

## Files to Change

- `core/lib/utils/issue/IssueTagger.js` — convert to the fully context-bound shape described above, including `markEnqueued(ids)`.
- `core/spec/utils/issue/IssueTagger_spec.js` — update mocks to stub `issueClient`/`context` instead of raw `origin`/`githubToken`/`fetchFn`; assertions on stdout/stderr text and `DispatchFailure` behavior should need no changes.

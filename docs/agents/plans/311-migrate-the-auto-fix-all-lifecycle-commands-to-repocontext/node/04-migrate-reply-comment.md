# Migrate AutoFixAllReplyComment

This command builds its own per-call `RepoContext` (`_repoContext(repoPath)`)
purely to feed `IssueClient`. Delete that builder and consume the injected
context. No `RepoPath#validate` is added — this command never had one; keep
parity.

## What to do

- `core/lib/core/commands.js`: add `takesRepoContext: true` to the
  `auto-fix-all-reply-comment` entry.
- Constructor: `constructor(repoContext, { execFileAsync = defaultExecFileAsync,
  fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, readFile = defaultReadFile }
  = {})`. Store `this._repoContext = repoContext`. **Drop** the `origin` and
  `githubToken` deps (they only existed to wire the internal `RepoContext`).
- Delete `_repoContext(repoPath)`.
- `_issueClient(repoPath)` → `_issueClient()`:
  `return new IssueClient({ context: this._repoContext, fetchFn: this._fetch,
  timeoutMs: this._timeoutMs });`
- `run(repoPath, id, agent, modelName, modelEmail, replyBody)` →
  `run(id, agent, modelName, modelEmail, replyBody)`:
  - Keep the `cleanId` derivation and the six-way validation, swapping
    `!repoPath` for `!this._repoContext.repoPath` (USAGE string unchanged).
  - `_resolvePrNumber(repoPath, cleanId)` / `_renderTemplate(repoPath, ...)` /
    `_postComment(repoPath, ...)` / `_pushCurrentBranch(repoPath)` — drop the
    `repoPath` parameter from each and read `this._repoContext.repoPath` inside.
    `_postComment` then calls `this._issueClient()`.
- Remove the now-unused `import RepoContext` and `import Origin` /
  `import GithubToken` lines if nothing else uses them (check: `Origin` /
  `GithubToken` are only used for the deleted deps; `RepoContext` only for the
  deleted `_repoContext`).
- `RESOLVE_PR_NUMBER_SCRIPT` (resolved relative to this repo's own root, not
  `repoPath`) is unchanged.
- No stdout/exit-code change — parity spec untouched.

## Tests

`core/spec/lib/commands/AutoFixAllReplyComment_spec.js`:

- The spec builds a `deps` object and does `new AutoFixAllReplyComment(deps)`.
  Change to `new AutoFixAllReplyComment(repoContext, deps)` where `repoContext`
  is `createRepoContextMock({ repoPath })` (its `origin`/`githubToken` spies
  back `IssueClient`'s token/repo resolution) or a real `RepoContext` wired with
  the fakes the spec already builds for `origin`/`githubToken`.
- Move `origin` / `githubToken` fakes out of `deps` and into the `RepoContext`
  construction.
- Every `run(REPO_PATH, id, ...)` → `run(id, ...)`.
- Keep `execFileAsync` / `fetchFn` / `timeoutMs` / `readFile` in `deps`.

## Files to Change

- `core/lib/core/commands.js` — flag on `auto-fix-all-reply-comment`.
- `core/lib/commands/AutoFixAllReplyComment.js` — constructor (drop `origin`/
  `githubToken`); delete `_repoContext`; `_issueClient()`; `run` + `_resolvePrNumber`
  / `_renderTemplate` / `_postComment` / `_pushCurrentBranch`; prune unused imports.
- `core/spec/lib/commands/AutoFixAllReplyComment_spec.js` — construct with
  context; move `origin`/`githubToken` fakes into it; `run(...)` call sites.

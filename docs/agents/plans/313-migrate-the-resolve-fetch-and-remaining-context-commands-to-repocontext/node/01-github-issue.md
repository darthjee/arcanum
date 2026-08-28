# Migrate GithubIssue (optional repoContext)

`GithubIssue` backs two registry entries — `github-issue-create` → `create`
and `github-issue-info` → `info` (`core/lib/core/commands.js:141-142`) — and is
**also** used zero-arg as a plain collaborator inside `RepoContext`
(`core/lib/context/RepoContext.js:35`, consumed by `RepoContext#createIssue` →
`this._githubIssue.create(this.repoPath, title, bodyFile)`). Both paths must
keep working, and there is a pre-existing `RepoContext` ↔ `GithubIssue`
circular import to avoid deepening.

## What to do

- Change the constructor to
  `constructor(repoContext, { origin = new Origin(), githubToken = new GithubToken(), repoPath = new RepoPath(), fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, lock = new Lock(), jsonParser, jsonValueFormatter, jsonReader, issueStatePaths } = {})`
  with `repoContext` **optional** (may be `undefined`). Store
  `this._repoContext = repoContext`. Keep every existing injectable exactly as
  today (`core/lib/commands/GithubIssue.js:49-60`).
- **Method arity is unchanged**: `create(repoPath, title, file)`,
  `info(repoPath)`, and `fetch(repoPath, id)` keep their leading `repoPath`
  parameter and their bodies unchanged, including `create`'s
  `this._repoPath.validate(repoPath)` and `info`'s deliberate lack of
  validation.
- On the CLI (flag-on) path the leading `repoPath` positional is stripped by
  `Dispatcher.commandArgs()`, so `create`/`info` would be called with the
  wrong leading argument. Bridge this by having the entry methods resolve
  `repoPath` from the context when it is absent — e.g. give `create`/`info`
  the signature `create(repoPath, title, file)` / `info(repoPath)` but
  default `repoPath` to `this._repoContext?.repoPath` when the first argument
  is `undefined`, then run the existing body. The collaborator path (explicit
  `repoPath` passed by `RepoContext#createIssue`) is unaffected.
- Keep the per-call helper builders (`_issueStateService(repoPath)` →
  `new RepoContext({ repoPath })`, `_issueClient(repoPath)` →
  `new RepoContext({ repoPath, origin: this._origin, githubToken: this._githubToken })`
  then `new IssueClient({ context, fetchFn, timeoutMs })`) as they are —
  driven by the resolved `repoPath`. Do **not** try to reuse
  `this._repoContext` here: on the collaborator path it is `undefined`, and on
  the CLI path the existing builders already produce an equivalent context.
- Update the code comment at `core/lib/commands/GithubIssue.js:192-194` (which
  currently explains the zero-arg constructor) to reflect that `repoContext`
  is now an optional first parameter used only by the CLI entrypoints.
- Set `takesRepoContext: true` on **both** `github-issue-create` and
  `github-issue-info` in `core/lib/core/commands.js:141-142`.
- Add `'github-issue-create'` and `'github-issue-info'` to the asserted
  `takesRepoContext` list in `core/spec/lib/core/commands_spec.js:12-35`.

## Tests

- `core/spec/lib/commands/GithubIssue_spec.js` — the existing 23 call sites use
  `new GithubIssue({ ...stubDeps(), fetchFn })` and invoke methods with a
  leading `repoPath`. Keep those as the **collaborator-path** coverage
  (construct with no `repoContext`, pass `repoPath` explicitly) — they already
  exercise the zero-arg path, satisfying the issue's "guard the
  `GithubIssue`-as-collaborator path" line.
- Add a small describe block for the **context-injected** path: construct
  `new GithubIssue(new RepoContext({ repoPath }), { ...stubDeps(), fetchFn })`
  and call `create(undefined, title, file)` / `info(undefined)`, asserting the
  same observable behavior (validation on `create`, none on `info`, correct
  `IssueClient` wiring).

## Files to Change

- `core/lib/commands/GithubIssue.js` — optional `repoContext` first constructor
  param; entry methods default `repoPath` to `this._repoContext?.repoPath`;
  update the zero-arg-constructor comment.
- `core/lib/core/commands.js` — `takesRepoContext: true` on
  `github-issue-create` and `github-issue-info`.
- `core/spec/lib/core/commands_spec.js` — extend the asserted flag list with
  both entries.
- `core/spec/lib/commands/GithubIssue_spec.js` — add the context-injected
  describe block; keep existing specs as collaborator-path coverage.

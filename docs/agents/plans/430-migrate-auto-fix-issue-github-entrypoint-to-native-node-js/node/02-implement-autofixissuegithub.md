# Implement AutoFixIssueGithub.js and register it

Create `core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js`, constructed with a `repoContext` plus injectable collaborators — mirror `PrOperations.js`'s direct-construction style (context-bound `GitHubClient`/`Git` built with sensible defaults in the constructor) rather than `AutoFixAllGithub.js`'s older `RepoContextFactory`-bundle indirection, since this module doesn't need multiple independently-rebuildable context-bound clients:

```js
constructor(repoContext, {
  githubClient = new GitHubClient({ context: repoContext }),
  git = new Git({ context: repoContext }),
  issueTagger = new IssueTagger({ context: repoContext }),
  issueStateServiceFactory = (id) => new IssueStateService({
    context: repoContext,
    issueStatePaths: new IssueStatePaths(repoContext)
    // + lock/jsonParser/jsonValueFormatter/jsonReader defaults, mirroring IssueState.js's own construction
  })
} = {}) { ... }
```

(`issueStateServiceFactory` as a factory, not a shared instance, only if `IssueStateService`/`IssueStatePaths` turn out to need per-call state tied to `id`; check `IssueStateService`'s actual constructor before assuming this — simplify to a plain shared instance if it doesn't.)

Four public methods, one per subcommand:

- **`info()`**: mirror `cmd_info` — `const { domain, repo } = await this._repoContext.resolveWithRef()` (or the equivalent `Origin` fields), return `` `DOMAIN=${domain}\nREPO=${repo}\n` ``. No usage-arg validation beyond `repoPath` (handled upstream by `Dispatcher`/`RepoContext#validate()`, same as every other migrated entrypoint).

- **`prCreate(title, file)`**: throw `Error(USAGE)` if `title`/`file` missing. Read `file`'s contents (`fs.readFile`, injectable like `AutoFixIssueCreateBranch.js`'s `readFile` dep) — throw `` Error(`Error: file not found: ${file}`) `` when it doesn't exist, matching the shell's exact message text. Call `this._githubClient.createPr(title, body)`, catching any failure and re-throwing `` Error(`Error: could not create PR on ${repoRef}`) `` (resolve `repoRef` via `resolveWithRef()`). On success: call `#_persistPrState(url)` and `#_syncPrLabelsAndState()` (both below), then return `` `${url}\n` ``.

- **`prView()`**: call `this._githubClient.getPr(branch)` (existing method — already returns `draft`/`html_url` fields from the REST pulls response, no new client method needed here). On lookup failure, throw `new DispatchFailure('', 1)` — **not** a plain `Error` — matching the shell's silent exit-1 contract for "no pull requests found" exactly (see `AutoFixAllGithub#hasShipitLabel` for the established pattern of this exact throw). On success: call `#_persistPrState(pull.html_url)`, then return `` `URL=${pull.html_url}\nIS_DRAFT=${pull.draft}\n` ``.

- **`prReady()`**: resolve the current PR (reuse `getPr` to get its `node_id`), call `this._githubClient.markPrReady(nodeId)`, catching any failure and re-throwing `` Error(`Error: could not mark PR ready on ${repoRef}`) ``. On success: best-effort re-fetch the PR URL (mirror the shell's own `gh pr view ... -q '.url' || true` — tolerate failure, only call `#_persistPrState` when a URL was actually resolved), then `#_syncPrLabelsAndState()`, then return `` `OK\n` ``.

Shared private helpers, ported from the shell's own `_persist_pr_state`/`_sync_pr_labels_and_state`:

- **`#_currentIssueId()`**: `await this._git.issueFromCurrentBranch()` — returns `{ id, branch }` or `null`, exactly the native equivalent of `_current_issue_id`.
- **`#_persistPrState(url)`**: no-op when `#_currentIssueId()` returns `null`. Otherwise extract the PR number from the URL's last path segment (mirror the shell's `"${url##*/}"`), then `set(id, 'pr_url', url)` and `set(id, 'pr_id', number)` via a per-call `IssueStateService` — best-effort, swallow failures (the shell redirects both calls' stderr to `/dev/null` and `|| true`s them).
- **`#_syncPrLabelsAndState()`**: no-op when `#_currentIssueId()` returns `null`. Otherwise: `repoRef` via `resolveWithRef()`; `await this._issueTagger.mutateTag(id, repoRef, 'add', 'pr')` (best-effort, warn-and-continue — this is `IssueTagger#mutateTag`, not `TagMutationService#addTag`, since the latter throws); fetch the issue's current labels (`this._issueTagger.fetchLabels(id)`, or `gh issue view` equivalent — tolerate failure with a stderr warning and return early, matching the shell); map to tags via `Tags.extractTags(labelNames)`; `setJson(id, 'tags', tags)` via `IssueStateService` (best-effort, warn on stderr on failure); if `tags.includes('shipit')`, add the PR-only `auto-shipit` label directly to the PR (`gh pr edit ... --add-label auto-shipit` has no existing native REST equivalent yet — add one, e.g. a small `GitHubClient#addLabelToPr` or reuse the issue-label REST endpoint against the PR number, since GitHub treats PRs as issues for the labels API; best-effort, warn on stderr on failure, never throw).

Register four entries in `core/lib/core/commands.js`'s `COMMANDS` map, alphabetically after `'auto-fix-all-wait-ci-and-merge'` and before `'auto-fix-issue-create-branch'`:

```js
'auto-fix-issue-github-info': {
  module: 'commands/auto-fix-issue/AutoFixIssueGithub.js',
  method: 'info',
  context: 'repo'
},
'auto-fix-issue-github-pr-create': {
  module: 'commands/auto-fix-issue/AutoFixIssueGithub.js',
  method: 'prCreate',
  context: 'repo'
},
'auto-fix-issue-github-pr-view': {
  module: 'commands/auto-fix-issue/AutoFixIssueGithub.js',
  method: 'prView',
  context: 'repo'
},
'auto-fix-issue-github-pr-ready': {
  module: 'commands/auto-fix-issue/AutoFixIssueGithub.js',
  method: 'prReady',
  context: 'repo'
},
```

## Files to Change

- `core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js` — new native module.
- `core/lib/core/commands.js` — add the four `auto-fix-issue-github-*` entries.

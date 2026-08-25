# PrOperations simplified

Rewrite `PrOperations` (`core/lib/utils/github/PrOperations.js`) to be a pure orchestrator, using all the context-bound collaborators from steps 01–04. This is the step where everything gets wired together, so it must land after all four.

Constructor receives every collaborator already context-bound:

```js
constructor({ context, gitClient = new GitClient({ context }),
              githubClient = new GitHubClient({ context }),
              gitBranch = new GitBranch({ context }),
              git = new Git({ context }),
              mergeBodyResolver = new MergeBodyResolver({ context, githubClient }) } = {}) {
```

(`gitBranch` is accepted for symmetry/testability even though `PrOperations` itself only calls through `git`, which wraps it.)

Each public method stops doing infra resolution — no `context.getToken()`, no `context.resolveWithRef()`, no threading `token`/`repo`/`repoRef` into any collaborator call, no inline `branch.match(/^issue-(\d+)$/)`, no `_resolveMergeBody` (delete that private method entirely — step 04 made `MergeBodyResolver#buildBody` self-sufficient).

`prNumber()`:

```js
async prNumber() {
  const issue = await this._git.issueFromCurrentBranch();

  if (issue) {
    const cached = await this._context.getIssueState(issue.id, 'pr_id');
    if (cached) return `${cached}\n`;
  }

  const branch = issue ? issue.branch : await this._git.currentBranch();
  const pull = await this._github.getPr(branch);

  return `${pull.number}\n`;
}
```

`prState()` — same branch resolution as today, just via `this._git.currentBranch()` and `this._github.getPr(branch)` (no `context`/`token`/`repo`/`repoRef`); `_prStateLabel(pull)` is unchanged (it's the one piece of pure derivation logic staying in this class per its own docstring).

`prMerge(modelEmail)` — same shape as today, but:
- branch/issue resolution goes through `this._git.issueFromCurrentBranch()` (replacing its own inline regex match)
- `const pull = await this._github.getPr(branch)` (no `repo`/`token`/`repoRef`)
- `const body = await this._mergeBodyResolver.buildBody(number, modelEmail)` (replacing `this._resolveMergeBody(...)`)
- `await this._github.mergePr(number, payload)` and `await this._github.deleteBranch(branch)` (both drop `repo`/`token`)

## Files to Change

- `core/lib/utils/github/PrOperations.js` — constructor + `prNumber`/`prState`/`prMerge` rewritten as above; `_resolveMergeBody` deleted; `_prStateLabel` untouched
- `core/spec/lib/utils/github/PrOperations_spec.js` — update every test's collaborator stubs to the new context-bound constructor shape and no-token/repo call signatures; verify `context.getToken()`/`context.resolveWithRef()` are never called from `PrOperations` itself

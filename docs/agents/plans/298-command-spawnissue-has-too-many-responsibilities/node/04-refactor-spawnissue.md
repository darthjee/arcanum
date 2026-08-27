# Refactor SpawnIssue to per-call RepoContext

Refactor `SpawnIssue`'s constructor and internals to stop threading `repoPath` through individually-constructed collaborators, and instead build a fresh, per-call `RepoContext` — mirroring `AutoFixAllGithub#_prOperations`. `core/bin/arcanum` always builds command instances with a zero-arg `new ModuleClass()` and only supplies `repoPath` later via `.run(repoPath, ...)`, so the constructor cannot take a `repoContext` parameter directly (confirmed via `IssueState.js`/`ArcanumSplitIssueCreateSubIssue.js`'s identical `_repoContext(repoPath)`-per-call pattern).

**Constructor** — remove `repoPath`, `repoConfig`; keep `execFileAsync`, `sleepFn`; keep `origin` (now forwarded into the per-call context instead of used directly); add `githubIssue` (now forwarded into the per-call context — reuse node/01's `RepoContext#createIssue`); add `configChain` (forwarded into the per-call context); default `labelApplicator = new LabelApplicator({ execFileAsync })` and `issueLinker = new IssueLinker({ execFileAsync })` (node/02, node/03), both injectable for tests.

Add a private helper:

```js
_repoContext(repoPath) {
  return new RepoContext({
    repoPath,
    origin: this._origin,
    githubIssue: this._githubIssue,
    configChain: this._configChain
  });
}
```

**`run(repoPath, parentId, title, bodyFile, asSubissueFlag)`** — signature and `STATUS=ok/ID=/URL=`/`STATUS=failed` output contract stay byte-identical (verified by `core/spec/bin/spawnIssueParity_spec.js` and depended on by `ArcanumSplitIssueCreateSubIssue.js`). Internally:

- Keep `this._repoPath.validate(repoPath)` as-is (still needed before the context is built).
- Build `const context = this._repoContext(repoPath);` once.
- `this._origin.resolve(repoPath)` → `context.resolve()`.
- Retry-config read: replace `this._repoConfig.getPlanIssuesRetryConfig(repoPath)` with `context.readConfig('plan-issues', 'max-retry-count')` / `context.readConfig('plan-issues', 'error-sleep-time')`, each coerced to a number with a fallback of `5` when absent/non-numeric (reuse `RepoConfig#_numberOrDefault`'s coercion logic inline or as a small private helper — see node.md's Notes on why `ConfigChain.js` itself needs no change).
- `_createWithRetry`: replace `this._githubIssue.create(repoPath, title, bodyFile)` with `context.createIssue(title, bodyFile)`.
- Replace the inline `_applyLabels(parentId, newId, repo)` call with `this._labelApplicator.apply(parentId, newId, repo)`.
- Replace the inline `_linkBack(parentId, newId, title, repo, asSubissue)` call with `this._issueLinker.link(parentId, newId, title, repo, asSubissue)`.
- Remove the now-dead `_applyLabels`, `_linkBack`, `_linkSubIssue`, `_nodeId` methods (moved to node/02, node/03).
- `_createWithRetry`, `_cleanup`, `_extractField`, `run` stay in `SpawnIssue` unchanged otherwise.

## Files to Change

- `core/lib/commands/SpawnIssue.js` — new constructor deps, `_repoContext(repoPath)` helper, `run`/`_createWithRetry` updated to use `context`/`this._labelApplicator`/`this._issueLinker`, dead methods removed.
- `core/spec/lib/commands/SpawnIssueSpec.js` — update every test's construction (`new SpawnIssue({ ...deps })`) for the new constructor shape; the label-application and linking test cases move to `LabelApplicatorSpec.js`/`IssueLinkerSpec.js` (node/02, node/03) — `SpawnIssueSpec.js` keeps only orchestration coverage (retry loop, config reads, delegation to the extracted classes, cleanup).

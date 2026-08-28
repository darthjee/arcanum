# Issue: Migrate SpawnIssue and AutoFixAllGithub to constructor-injected RepoContext

## Description

Part of #308 (thread `repoPath`/`repoConfig` through a constructor-injected `RepoContext` instead of a leading positional CLI argument). Infra landed in #309; #310 and #311 migrated the `arcanum-split-issue-*` and `auto-fix-all-*` lifecycle command families.

`SpawnIssue` (`core/lib/commands/SpawnIssue.js`) and `AutoFixAllGithub` (`core/lib/commands/AutoFixAllGithub.js`) are the last GitHub-facing entrypoints still on the old shape:

- `core/bin/arcanum` / `Dispatcher` build them zero-arg (`spawn-issue` and all seven `auto-fix-all-github-*` entries lack `takesRepoContext`).
- Each builds its own fresh per-call `RepoContext` once `repoPath` is known — `SpawnIssue#_repoContext(repoPath)` (direct `new RepoContext(...)`), `AutoFixAllGithub#_prOperations` / `#_issueTagger` / `#_tagMutationService` (per-call bundles via `RepoContextFactory#build(repoPath)`).
- Every method takes a leading `repoPath` positional argument.
- Two internal callers carry a documented interim asymmetry: `AutoFixAllWaitCiAndMerge` builds `new AutoFixAllGithub()` and calls `prMerge(repoPath, modelEmail)` (with an explicit `until #312` comment), and `ArcanumSplitIssueCreateSubIssue` builds `new SpawnIssue()` and calls `run(repoPath, ...)`.

## Solution

### `core/lib/core/commands.js`

- Set `takesRepoContext: true` on `spawn-issue`.
- Set `takesRepoContext: true` on every `auto-fix-all-github-*` entry (`add-tag`, `cleanup-branch`, `has-shipit-label`, `pr-merge`, `pr-number`, `pr-state`, `remove-tag`) — they share one class, so they must all flip together.

### `SpawnIssue`

- `constructor(repoContext, { ...injectables } = {})` — store `repoContext`; keep `labelApplicator` / `issueLinker` / `sleepFn` / `execFileAsync` injectable for tests.
- Delete `_repoContext(repoPath)` and the `origin` / `githubIssue` / `configChain` constructor params that only fed it; use `this._repoContext` directly.
- `run(parentId, title, bodyFile, asSubissueFlag)` — drop the leading `repoPath` param; read it from `repoContext.repoPath` where the label/link/cleanup delegates still need the raw path.
- Update `ArcanumSplitIssueCreateSubIssue` (already `takesRepoContext`) to construct `new SpawnIssue(this._repoContext)` and call `run(...)` without the leading path.

### `AutoFixAllGithub`

- `constructor(repoContext, { ...injectables } = {})` — store `repoContext`; keep `repoContextFactory` / `issueTaggerFactory` / `branchCleanup` injectable.
- Rework `_prOperations` / `_issueTagger` / `_tagMutationService` to build their per-call bundle from the injected context (`repoContextFactory.buildFromContext(this._repoContext)`), following the `AutoFixAllWaitCi` precedent from #311 — the bare `RepoContext` isn't enough for `PrOperations` / `IssueTagger` / `TagMutationService`, which consume the context-bound-client bundle.
- Each method loses its leading `repoPath` parameter; `cleanupBranch` reads `this._repoContext.repoPath` and keeps passing it raw to `BranchCleanup`.
- Update `AutoFixAllWaitCiAndMerge` to construct `new AutoFixAllGithub(repoContext)` and call `prMerge(modelEmail)` without the leading path, removing the interim-asymmetry comment.

### Tests

- Rework `core/spec/lib/commands/SpawnIssue_spec.js` and `core/spec/lib/commands/AutoFixAllGithub_spec.js` to inject a `RepoContext` (or `RepoContextFactory`-built bundle) at construction instead of asserting on the internal per-call builder, and drop the leading `repoPath` from method calls.
- Adjust `AutoFixAllWaitCiAndMerge_spec.js` and `ArcanumSplitIssueCreateSubIssue_spec.js` for the new `SpawnIssue` / `AutoFixAllGithub` construction and call shapes.

### Out of scope

- Other command families (sub-issues #313) and the `takesRepoContext` flag / `commandArgs()` branch removal (#314).
- Skill `.md` call sites and `arcanum/_lib/*.sh` wrappers keep passing `repoPath` as the leading positional argument so the Dispatcher can build the context from it.

## Benefits

- `SpawnIssue` and `AutoFixAllGithub` stop re-deriving repo context: the `Dispatcher` builds it once and injects it, matching every other migrated command.
- Deletes `SpawnIssue#_repoContext` and collapses `AutoFixAllGithub`'s per-call builders onto the shared injected context.
- Clears the last documented interim asymmetry in `AutoFixAllWaitCiAndMerge`, unblocking the #314 cleanup that drops the flag entirely.

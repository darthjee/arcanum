# Issue: Migrate AutoFixAllWaitCi._prOperations to RepoContextFactory

## Description

Deferred half of #304 / #306: now that `RepoContextFactory` (`core/lib/context/RepoContextFactory.js`) exists and `AutoFixAllGithub` builds every per-call `RepoContext` bundle through it, `AutoFixAllWaitCi` should do the same instead of hand-assembling its own context bundle in `_prOperations(repoPath)`.

## Problem

`AutoFixAllWaitCi.js` still carries its own `_prOperations(repoPath)` builder — ~13 lines near-identical to the one `AutoFixAllGithub` no longer has. It hand-builds a `RepoContext` with only `origin`/`githubToken` (no `issueStateService`/`configChain`), then a context-bound `GitClient`/`GitBranch`/`Git`/`GitHubClient` alongside it — exactly the reduced-dep bundle `RepoContextFactory` was designed to produce (`RepoContext` supplies its own defaults for the absent `issueStateService`/`configChain`). The bundle's extra `issueClient` key is simply ignored by `PrOperations`, same as in `AutoFixAllGithub._prOperations`.

Split off from #304 to keep that refactor tight and avoid re-touching `AutoFixAllWaitCi` immediately after its own #300 refactor.

## Solution

- Rewrite `AutoFixAllWaitCi._prOperations(repoPath)` to delegate to `RepoContextFactory` — `new PrOperations(this._repoContextFactory.build(repoPath))`, mirroring `AutoFixAllGithub._prOperations`.
- Keep `_prChecker(repoPath)` wrapping the resulting `PrOperations` as it does today.
- Adopt the injected-`repoContextFactory` constructor shape from `AutoFixAllGithub` (#306): the command holds a `repoContextFactory` collaborator (defaulting to `new RepoContextFactory()`), which owns the `origin`/`githubToken`/`execFileAsync`/`fetchFn`/`timeoutMs` wiring. `repoConfig`, `pollIntervalMs`, and `sleepFn` stay as direct constructor deps — they are not part of the context bundle.
- Remove the now-redundant direct imports that only existed to hand-build the context: `Git`, `GitBranch`, `GitClient`, `GitHubClient`, `RepoContext`, `Origin`, `GithubToken` — the injected `RepoContextFactory` owns that wiring now. `PrChecker`, `PrOperations`, and `RepoConfig` imports stay.
- Update `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` to the new construction path, mirroring `AutoFixAllGithub_spec.js`'s `newGithub` helper (flat override keys — `origin`/`githubToken`/`execFileAsync`/`fetchFn`/`timeoutMs` — feeding an injected `RepoContextFactory`; other keys forwarded to the constructor).

## Rules

- Byte-identical stdout / exit-code parity with `wait_ci.sh` — `core/spec/bin/autoFixAllWaitCiParity_spec.js` must stay green.
- No behavior change — pure internal wiring swap.
- `core/spec/lib/` mirrors `core/lib/` structure.

## Out of scope

- Any further consolidation (shared base class / mixin) between `AutoFixAllGithub` and `AutoFixAllWaitCi`.
- Changes to `AutoFixAllWaitCiAndMerge` beyond what zero-arg `new AutoFixAllWaitCi()` construction already covers.

## Benefits

- Removes ~13 lines of duplicated context-assembly wiring.
- One place (`RepoContextFactory`) owns per-call `RepoContext` bundle construction across both `AutoFix` commands.
- Drops five now-unused imports from `AutoFixAllWaitCi.js`.

# Reduce AutoFixAllGithub to a thin facade

Rewrite `core/lib/commands/AutoFixAllGithub.js` down to a thin facade (target: under ~100 lines) that delegates all 7 subcommands:

- `prNumber`, `prState`, `prMerge` → delegate to an injected `prOperations` (`PrOperations`, from step 03).
- `cleanupBranch` → delegate to an injected `branchCleanup` (`BranchCleanup`, from step 04).
- `addTag`, `removeTag` → delegate to an injected `issueTagger` (`IssueTagger`).
- `hasShipitLabel` → call `issueTagger.hasLabel(id, repo, token, 'shipit')` (from step 02), keeping the exact same `DispatchFailure('', 1)` wrapping around any failure (repo resolution, token fetch, or label fetch) that `hasShipitLabel` has today — `IssueTagger.hasLabel()` throws a plain `Error`, and this facade method is what converts that into `DispatchFailure('', 1)`.

Build `origin`/`githubToken` once in the constructor and pass the *same* instances into the `issueTagger`/`prOperations`/`branchCleanup` defaults, mirroring `AutoFixAllQueue`'s existing constructor pattern — do not let each collaborator build its own independent `Origin`/`GithubToken`.

Every public method's usage string (`'Usage: github.sh ...'`) and error-throwing shape must stay identical to today — this is a pure wiring change, not a behavior change.

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — replace the bodies of all 7 public methods with delegation to the injected `issueTagger`/`prOperations`/`branchCleanup`; remove every method/helper now duplicated in `PrOperations`, `BranchCleanup`, or `IssueTagger`; update the constructor to build and share `origin`/`githubToken` across all three default collaborators.

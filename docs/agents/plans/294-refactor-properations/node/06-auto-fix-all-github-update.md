# AutoFixAllGithub updated

`AutoFixAllGithub` (`core/lib/commands/AutoFixAllGithub.js`) is the only other production consumer of these classes. It currently builds one shared `gitClient`/`githubClient` pair in its own constructor and reuses that pair across every per-call `PrOperations` (one per `repoPath`, via `_prOperations(repoPath)`). Now that `GitClient`/`GitHubClient` are context-bound (steps 02–03), that sharing pattern no longer works — a `GitHubClient` built without a `context` can't resolve `token`/`repo`/`repoRef` at all.

- `_prOperations(repoPath)` — after building the per-call `context` (unchanged), also build a fresh `gitClient = new GitClient({ context })` and `githubClient = new GitHubClient({ context })` right there, and pass those into `new PrOperations({ context, gitClient, githubClient })`. Both are cheap, stateless-construction objects (no I/O in their constructors), so building them per call has no meaningful cost.
- Constructor — drop the `gitClient`/`githubClient` injectable defaults (`new GitClient({ execFileAsync })` / `new GitHubClient({ fetchFn, timeoutMs })`) and the fields that stored them (`this._gitClient`/`this._githubClient`), since they're no longer shared singletons. Keep `execFileAsync`/`fetchFn`/`timeoutMs` as constructor params if `_prOperations` still needs to forward them into the per-call `GitClient`/`GitHubClient` (it does, to preserve today's test-injection points).
- Update the class-level and constructor JSDoc, which currently documents `gitClient`/`githubClient` as "shared ... across every per-call `PrOperations`" — that sentence becomes inaccurate and must be rewritten to describe the new per-call construction.
- `prNumber`/`prState`/`prMerge` and the other public methods (`cleanupBranch`, `hasShipitLabel`, `addTag`, `removeTag`) keep their exact same signatures — no CLI-facing change (see the issue's "Expected Behavior").

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — `_prOperations(repoPath)` builds `gitClient`/`githubClient` per call from the per-call `context`; constructor/JSDoc updated to drop the shared-singleton framing
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — update tests that assert the shared `gitClient`/`githubClient` singleton is reused across multiple `_prOperations()`/`prNumber`/`prState`/`prMerge` calls; assert instead that a fresh context-bound pair is built per call

## Notes

- No changes needed in `core/spec/bin/autoFixAllGithubParity/{pr_number,pr_state,pr_merge}_spec.js` — these exercise CLI-facing behavior only, which is unchanged; run them as a regression check after this step.

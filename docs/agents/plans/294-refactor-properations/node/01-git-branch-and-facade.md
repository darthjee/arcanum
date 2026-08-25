# GitBranch + Git facade

Add two new classes, purely additive — nothing existing changes yet, so this step carries no breaking changes.

`GitBranch` (`core/lib/utils/git/GitBranch.js`) owns `issue-<id>` branch parsing. It's constructed with `{ context, gitClient = new GitClient({ context }) }` and delegates the actual `git branch --show-current` call to the injected `GitClient` rather than re-implementing it — `GitBranch` only adds the issue-regex logic on top:

- `currentBranch()` — no `repoPath` param; implemented as `this._gitClient.currentBranch()`.
- `issueFromCurrentBranch()` — calls `this.currentBranch()`, then runs `branch.match(/^issue-(\d+)$/)`. Returns `null | { id, branch }` so callers get both values from a single call. This eliminates the regex currently duplicated in `PrOperations#prNumber` and `#prMerge` (removed in step 05).

`Git` (`core/lib/utils/git/Git.js`) is a thin wrapper facade, constructed with `{ context }`, that directs `currentBranch`/`issueFromCurrentBranch` to an internally-built `GitBranch`. This is the class `PrOperations` will actually depend on (step 05), keeping `GitBranch` an implementation detail.

Note: at this point `GitClient` is still the pre-refactor version (`currentBranch(repoPath)` takes an explicit param, per step 02) — `GitBranch` calls it that way for now; step 02 makes both sides context-bound together.

## Files to Change

- `core/lib/utils/git/GitBranch.js` — new class, as described above
- `core/lib/utils/git/Git.js` — new facade class, as described above
- `core/spec/lib/utils/git/GitBranch_spec.js` — new spec: `currentBranch()` delegates to the injected `gitClient`; `issueFromCurrentBranch()` returns `{ id, branch }` for a branch matching `issue-<id>`, and `null` otherwise
- `core/spec/lib/utils/git/Git_spec.js` — new spec: both methods delegate to the internal `GitBranch`

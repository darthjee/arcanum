# GitClient becomes context-bound

Update the existing `GitClient` (`core/lib/utils/git/GitClient.js`) to take `context` in its constructor instead of receiving `repoPath` as a method parameter:

- Constructor: `{ context, execFileAsync = defaultExecFileAsync }`.
- `currentBranch()` — no `repoPath` param; resolves it internally via `this._context.repoPath` (a plain field on `RepoContext`, not an async call) before running `git branch --show-current`.

`GitBranch` (step 01) already calls `this._gitClient.currentBranch()` with no args, so once this step lands, `GitBranch`'s call site needs no further change — the two were written to match up.

## Files to Change

- `core/lib/utils/git/GitClient.js` — constructor takes `context`; `currentBranch()` drops the `repoPath` param, reading `this._context.repoPath` instead
- `core/spec/lib/utils/git/GitClient_spec.js` — update to construct `GitClient` with a stub/fake `context` (exposing `repoPath`) and call `currentBranch()` with no args

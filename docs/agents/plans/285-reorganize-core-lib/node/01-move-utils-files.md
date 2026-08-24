# Move utils/ files into domain subfolders

Move every non-dispatched `core/lib/*.js` file into its domain subfolder under `core/lib/utils/`, per the issue's finalized structure. Do this before step 02 (moving `commands/` files) so every `utils/` target path is final by the time `commands/` imports get rewritten once.

For each file: `git mv` it to its target path, then fix up import paths in both directions:
- **Its own `import ... from './Y.js'` lines** (dependencies on other `core/lib/*.js` files) — recompute the relative path from the new location. A dependency that is itself a utils/ file being moved in this same step should point at its own new location; a dependency that stays a `commands/` file (not yet moved — still at `core/lib/X.js` during this step) becomes `../X.js` from inside `utils/<category>/`.
- **Every other `core/lib/*.js` file that currently imports this file** — update `./<OldName>.js` to `./utils/<category>/<OldName>.js` (those importers are still flat in `core/lib/` at this point in the sequence; if an importer is itself also being moved in this step, resolve directly to its post-move relative path instead of a two-hop edit).

## Files to Change

- `core/lib/GithubToken.js` → `core/lib/utils/github/GithubToken.js`
- `core/lib/QueueStore.js` → `core/lib/utils/queue/QueueStore.js`
- `core/lib/Lock.js` → `core/lib/utils/file/Lock.js`
- `core/lib/IssueFile.js` → `core/lib/utils/file/IssueFile.js`
- `core/lib/RepoPath.js` → `core/lib/utils/file/RepoPath.js` (highest fan-in of any file in the reorg — double-check every importer, inside and outside `core/lib/`, e.g. spec files, is caught)
- `core/lib/ConfigChain.js` → `core/lib/utils/config/ConfigChain.js`
- `core/lib/RepoConfig.js` → `core/lib/utils/config/RepoConfig.js`
- `core/lib/IssueTagger.js` → `core/lib/utils/issue/IssueTagger.js` (imports `DispatchFailure.js`, also moving in this step — point it at `../errors/DispatchFailure.js`)
- `core/lib/Tags.js` → `core/lib/utils/issue/Tags.js`
- `core/lib/Origin.js` → `core/lib/utils/git/Origin.js`
- `core/lib/InvocationLog.js` → `core/lib/utils/logging/InvocationLog.js`
- `core/lib/DispatchFailure.js` → `core/lib/utils/errors/DispatchFailure.js`
- every `core/lib/*.js` file that imports any of the 12 files above — grep for each old filename across `core/lib/` and update the import path (do not touch `core/spec/lib/` yet, that's step 05)

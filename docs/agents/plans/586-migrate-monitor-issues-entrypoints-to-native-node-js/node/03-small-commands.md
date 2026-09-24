# Config, rewrite-queue and github commands

All three go under `core/lib/commands/monitor-issues/`.

- `MonitorIssuesConfig.js` (`context: 'none'`): `get(repoPath, key)`, `isEnabled(repoPath, key)`, `set(repoPath, key, value)` and `toggle(repoPath, key)`, built on the step 01 helper with the monitor-issues file resolver. Error and usage messages match the `config_*_shell.sh` files exactly (e.g. `Error: get requires a key`, `Error: value must be 'true' or 'false'`). `is-enabled` returning false becomes `DispatchFailure('', 1)`.
- `MonitorIssuesRewriteQueue.js` (`context: 'repo'`): takes a `repoContext` and a `QueueStore` configured with the rewrite-queue file names.
  - `push(id)` acquires the lock, appends `{id}` only if it isn't already present, releases the lock, then returns `Pushed: <id>\n`. A missing id gives `Error: push requires an ID`.
  - `pop()` acquires the lock and returns `<id>\n`. On an empty queue it releases the lock and throws `DispatchFailure('', 1)`.
  - It is also used in-process by step 04.
- `MonitorIssuesGithub.js` (`context: 'repo'`): `removeTag(id, tag)` delegates to `TagMutationService#removeTag`, mirroring `AutoFixAllGithub#removeTag`, with usage error `Usage: github.sh remove-tag <repo_path> <id> <tag>`. Share code with `AutoFixAllGithub` where you can instead of copying it.

## Files to Change
- `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` — new
- `core/lib/commands/monitor-issues/MonitorIssuesRewriteQueue.js` — new
- `core/lib/commands/monitor-issues/MonitorIssuesGithub.js` — new
- `core/spec/lib/commands/monitor-issues/*_spec.js` — unit specs

# node Plan: Migrate auto-monitor-issue-pr-resolve-pr-number entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registers `'auto-monitor-issue-pr-resolve-pr-number'` in `core/lib/core/commands.js`'s `COMMANDS` map — this exact string must match the `migration-status.json` key and the `<command>` argument scripter's shim passes to `engine_dispatch`.
- Writes the parity test against `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh` — the exact path scripter's rename produces — invoked directly, never through the shim.
- Can rely on `HOME` being present in `process.env` when invoked natively through scripter's shim (needed for GitHub token resolution).

## Implementation Steps

### Step 1 — Implement the native module and register it

Create `core/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js`, `context: 'repo'` (so `RepoContext` is injected as the sole constructor argument, per `docs/agents/architecture/script-engine.md`'s dispatch-table contract). Follow `core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js`'s composition pattern closely — it already resolves a branch's PR the same way this entrypoint needs to:

- Constructor: `constructor(repoContext, { git = new Git({ context: repoContext }), githubClient = new GitHubClient({ context: repoContext }), issueStateService = new IssueStateService({ context: repoContext }) } = {})`.
- `run(id)`: validate `id` is present and numeric (`#` prefix stripped first, mirroring `resolve_pr_number_shell.sh`'s `ID="${ID#\#}"` then `[[ "$ID" =~ ^[0-9]+$ ]]`), throwing the shell script's exact usage message on failure — verify the precise string against a direct run of `resolve_pr_number_shell.sh` with a missing/non-numeric `id`, since parity is judged byte-for-byte.
- Cache-hit path: call `issueStateService.get(id, 'pr_id')`; if the result is non-empty, return it with a trailing newline (mirroring `IssueState.js`'s own `get`-command convention: `result === '' ? '' : \`${result}\n\``) and skip the API lookup entirely.
- API-lookup path (cache miss): resolve the current branch via `git.currentBranch()`, then call `githubClient.getPr(branch)` and return `${pr.number}\n`. `getPr` already throws `Error: no pull request found for the current branch on <repoRef>` on any failure (network, no matching PR, malformed response) — let it propagate uncaught, matching the shell script's `Error: no pull request found for the current branch on $repo_ref` exit-1 contract exactly (no rewrapping needed, the message shape already matches).
- Do not shell out to `gh` and do not re-derive `origin.sh`'s `_ensure_gh_user`/`get_repo_ref` — `GitHubClient#getPr` already resolves `repo`/`repoRef`/token internally via the injected `RepoContext`.

Register in `core/lib/core/commands.js`'s `COMMANDS` map, alphabetically between `'auto-fix-issue-run-checks'` and `'checkout-safe-branch'`:

```js
'auto-monitor-issue-pr-resolve-pr-number': {
  module: 'commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js',
  method: 'run',
  context: 'repo'
},
```

### Step 2 — Unit and parity tests

Write `core/spec/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber_spec.js` (Jasmine, mirroring `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`'s style for mocking `git`/`githubClient`/`issueStateService` collaborators): cover the missing/non-numeric `id` usage-error path, the `#`-prefix-stripping behavior, the cache-hit short-circuit (returns the cached `pr_id` without calling `git.currentBranch()`/`githubClient.getPr()` at all), the cache-miss → API-lookup path (returns `getPr(branch).number`), and the not-found error propagating unchanged from `getPr`.

Write `core/spec/bin/autoMonitorIssuePrResolvePrNumberParity/*.js` (mirroring `core/spec/bin/autoFixIssueGithubParity/pr_view_spec.js`'s structure and its `setupParityTest`/`runBoth`/`expectParity` helpers): isolated fixture repos comparing `resolve_pr_number_shell.sh` directly against `core/bin/arcanum auto-monitor-issue-pr-resolve-pr-number` for byte-identical stdout/exit code, using the same fake-`gh` (`FAKE_GH_*` env vars, shell side) / fake-`fetch` (`FAKE_FETCH_*` env vars, native side) double established there — per `docs/agents/architecture/script-engine.md`'s "no real network calls in CI" rule. Cover at minimum: the cache-hit path (pre-seed `.claude/state/issue-<id>.json`'s `pr_id` field identically on both sides — no `gh`/`fetch` double needed at all), the cache-miss → successful API-lookup path, the missing-argument/non-numeric-`id` usage-error path, and the not-found error path (double both `gh` and `fetch` to return no matching PR). This test set is also what exercises `arcanum/_lib/engine_dispatch.sh`'s `engine.mode=native`/`engine.mode=shell` routing end-to-end, satisfying that verification step.

## Files to Change

- `core/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber.js` — new native module.
- `core/lib/core/commands.js` — add the `auto-monitor-issue-pr-resolve-pr-number` entry.
- `core/spec/lib/commands/auto-monitor-issue-pr/AutoMonitorIssuePrResolvePrNumber_spec.js` — new unit tests.
- `core/spec/bin/autoMonitorIssuePrResolvePrNumberParity/` — new parity test spec file(s).

## CI Checks

- `core/`: `yarn test` (CI job: `test`, `.circleci/config.yml`) — local equivalent: `make core-test`.
- `core/`: `yarn lint` (CI job: `checks`, `.circleci/config.yml`) — local equivalent: `make core-lint`.

## Notes

- Depends on scripter's Step 1 (the `_shell.sh` rename) landing first, or at least in the same PR, since the parity test invokes `resolve_pr_number_shell.sh` by that exact path.
- `core/lib/utils/github/GitHubClient.js`, `core/lib/utils/git/Git.js`, and `core/lib/services/IssueStateService.js` stay untouched — this issue only consumes their existing public methods, it does not need to extend any of them.

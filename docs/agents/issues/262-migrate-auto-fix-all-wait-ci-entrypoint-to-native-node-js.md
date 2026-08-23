# Issue: Migrate auto-fix-all-wait-ci entrypoint to native Node.js

Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

## Source script

`auto-fix-all/scripts/wait_ci.sh`

Blocking loop (5s sleep) that polls the GitHub Checks API for all check-runs on a PR's head commit, from any CI provider. Ignores check-runs matching the project's configured `ignored_check_patterns` (`.claude/configuration/arcanum-repo-config.json`, namespace `auto-fix-all`). Prints `passed` or `failed` (+ failed check-run names) on the first line.

## Migration

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-all/scripts/wait_ci.sh` for its exact output/exit-code contract.
2. Create `core/lib/AutoFixAllWaitCi.js` (zero runtime deps, built-in Node APIs only; use the global `fetch` plus `gh auth token` for the GitHub REST calls, per the doc's design — not the `gh pr view`/`gh api` CLI subcommands the shell version uses). For the mockable/injectable poll interval called out below, follow the same constructor-injected sleep precedent already used by `core/lib/Lock.js` (`sleepMs` option) and `core/lib/SpawnIssue.js` (`sleepFn` dependency) — no new pattern needed here.
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'auto-fix-all-wait-ci': { module: 'AutoFixAllWaitCi.js', method: 'run' }`.
4. Add `"auto-fix-all-wait-ci": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/AutoFixAllWaitCi_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code) — **note:** this script polls forever with a 5s sleep until check-runs resolve, so both the native unit tests and the parity test need a way to avoid a genuinely long-running/hanging test (e.g. a short, mockable/injectable poll interval, or fully mocked `fetch` responses that resolve on the first poll).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- GitHub REST API: PR lookup (head commit SHA) and the Checks API (`check-runs`) — currently via `gh pr view`/`gh api`. No real network calls in CI: mock/stub via `core/spec/support/fixtures/`.
- Reads `ignored_check_patterns` from `arcanum/_lib/repo_config.sh` (not yet migrated) — re-derive the read logic natively. `core/lib/RepoConfig.js` already exists but only covers the single-tier local-state reads used by `getSafeBranch`/`getPlanIssuesRetryConfig`; it does not yet implement the `.claude/configuration/arcanum-repo-config.json` namespaced read (`repo_config_read`) that `ignored_check_patterns` needs, so add a new method there for this read rather than reinventing the read logic inline in `AutoFixAllWaitCi.js`.
- Sets `GH_INSECURE_SKIP_VERIFY=true` before shelling to `gh` — this is a `gh`-CLI-specific TLS setting; confirm during implementation whether the native `fetch`-based call needs an equivalent (likely not, since it's not going through the `gh` binary).

## Dependencies on other sub-issues

None blocking this one. Note: the sibling sub-issue for `auto-fix-all-wait-ci-and-merge` (later in the batch) depends on this migration landing first, since `wait_ci_and_merge.sh` directly invokes `wait_ci.sh`.

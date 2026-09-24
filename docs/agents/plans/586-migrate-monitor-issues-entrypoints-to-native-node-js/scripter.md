# Scripter Plan: Migrate monitor-issues entrypoints to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

The scripter produces the shims and `*_shell.sh` files that invoke the 8 command keys in [plan.md](plan.md#command-names-and-native-invocations). Each one uses the native invocation, `--prepend-repo-path` usage and env allowlist listed in that table. The node agent provides the matching `core/lib/core/commands.js` entries.

## Steps

- [01 — Split config.sh](scripter/01-split-config.md)
- [02 — Split rewrite_queue.sh](scripter/02-split-rewrite-queue.md)
- [03 — Split github.sh and monitor_issues.sh](scripter/03-split-github-and-monitor.md)
- [04 — Flip migration status and regenerate the doc](scripter/04-migration-status.md)

## CI Checks

- shell scripts: `shellcheck` on every changed/added `monitor-issues/scripts/*.sh` (see `.circleci/config.yml` / `.github/workflows/*` for the exact job)
- shell specs, if the repo's shell test suite covers `monitor-issues/scripts/`: run it locally as CI does

## Notes

- None of the callers change: `monitor-issues/SKILL.md`, `toggle-monitor-clear-context/SKILL.md` and `auto-rewrite-issue/steps/run.md` keep their current invocations.
- `monitor_issues_shell.sh` still calls `rewrite_queue.sh` (the shim), `auto-fix-all/scripts/queue.sh` and `auto-fix-issue/scripts/issue_state.sh` as it does today. Only the native side runs these in-process.
- SIGTERM/Ctrl-C: check that stopping `monitor_issues.sh` in `engine.mode=native` also stops the `core/bin/arcanum` child. If `engine_dispatch` doesn't `exec` the child, forward the signal or `exec` from the shim, and describe what you did in the PR.

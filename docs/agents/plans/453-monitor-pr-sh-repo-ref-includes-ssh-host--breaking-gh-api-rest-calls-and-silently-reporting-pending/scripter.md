# Scripter Plan: monitor_pr.sh REPO_REF includes SSH host, breaking gh api REST calls and silently reporting pending

Main plan: [plan.md](plan.md)

## Steps

- [01 — Fix the REST-path call in monitor_pr_shell.sh](scripter/01-fix-monitor-pr-shell-rest-path.md)
- [02 — Add SSH-proxy-style origin test coverage](scripter/02-add-ssh-proxy-origin-test-coverage.md)
- [03 — Add REST-path regression test for monitor_pr_shell.sh](scripter/03-add-monitor-pr-shell-rest-test.md)

## Notes

- No new helper is needed in `arcanum/_lib/origin.sh` — `get_repo_path` already exists and already returns the bare `owner/repo`, and is already used correctly in `auto-fix-all/scripts/wait_ci_shell.sh`.
- No other call site needs fixing. A repo-wide `gh api repos/...` search found exactly two such call sites total: this one (broken) and `wait_ci_shell.sh` (already correct). Every other `get_repo_ref`/`repo_ref` consumer only ever feeds `gh`'s `-R`/`--repo` flag, which tolerates the domain-qualified form.
- No native-side change is needed. `auto-monitor-pr/scripts/monitor_pr.sh` is already an `engine_dispatch` shim to `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js`, whose `GitHubClient#getPrReviewComments()` already builds its REST URL from the bare `repo` (via `Origin#resolveWithRef()`), never the domain-qualified `repoRef`.
- None of `arcanum/_lib`'s `test_*.sh` files (including `test_origin_resolution.sh`) are wired into CI (`.circleci/config.yml` only runs `yarn test` for the Node suite) — they're standalone regression scripts run manually, so no `## CI Checks` section applies here.

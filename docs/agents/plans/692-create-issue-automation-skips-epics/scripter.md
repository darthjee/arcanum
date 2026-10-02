# Scripter Plan: Create-issue: automation skips Epics

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce the shell half of `github.sh has-label <repo_path> <id> <name>` (exit `0`/`1`, case-insensitive literal whole-name match, usage error exits `1`). Route it and the `has-shipit-label` alias through the engine-dispatch key `auto-fix-all-github-has-label`, as described in [plan.md](plan.md#has-label-cli).
- Produce the shell half of the `monitor-issues` Epic skip: log `Skipping #<id>: Epic`, dispatch nothing, still record `updated_at`/`tags`.
- node relies on the `migration-status.json` key `auto-fix-all-github-has-label: true`, which replaces `auto-fix-all-github-has-shipit-label`.

## Implementation Steps

### Step 1 — Generalize `has-shipit-label` to `has-label` (shell)

- `github_shell.sh`: rename `cmd_has_shipit_label` to `cmd_has_label <repo_path> <id> <name>`. Match with `grep -qixF -- "$name"` (literal, case-insensitive, whole line) instead of the hard-coded regex. Add `has-label` to the subcommand list, the dispatch `case` and the usage text. Keep `has-shipit-label` as `cmd_has_label "$1" "$2" shipit`.
- Add `github_shell_has_label.sh`, modeled on the existing per-subcommand wrapper, and delete `github_shell_has_shipit_label.sh`.
- `github.sh`: add a `has-label)` branch that runs `engine_dispatch "$REPO_PATH" auto-fix-all-github-has-label "${SCRIPT_DIR}/github_shell_has_label.sh" HOME -- "${@:2}"`. Change the `has-shipit-label)` branch to the same key and wrapper with args `"$2" "$3" shipit`. Update the header comment ("bundles eight subcommands"; the alias note) and the usage text.
- `arcanum/_lib/migration-status.json`: replace `auto-fix-all-github-has-shipit-label` with `auto-fix-all-github-has-label: true`.

### Step 2 — Skip Epics in `monitor-issues` (shell)

In `monitor-issues/scripts/monitor_issues_shell.sh`, after `TAGS_JSON` is built and before the `actionable_tags` loop, check `has_tag "$LABELS" epic`. If it matches, `_log "Skipping #${ISSUE_ID}: Epic"` and skip the dispatch loop, leaving `ISSUE_DISPATCH_FAILED=0` so the existing state-recording block still runs. Update the comment above the loop.

## Files to Change

- `auto-fix-all/scripts/github_shell.sh` — `cmd_has_label`, the `has-label` subcommand, the alias, and usage.
- `auto-fix-all/scripts/github.sh` — the `has-label` branch, the alias routed to the same key, header, and usage.
- `auto-fix-all/scripts/github_shell_has_label.sh` — new wrapper.
- `auto-fix-all/scripts/github_shell_has_shipit_label.sh` — deleted.
- `arcanum/_lib/migration-status.json` — key swap.
- `monitor-issues/scripts/monitor_issues_shell.sh` — Epic skip.

## CI Checks

- Shellcheck/lint and parity specs: `make core-check` (the parity specs are written by node and exercise these scripts).

## Notes

- `wait_ci_and_merge_shell.sh` and other direct callers of `github_shell.sh` do not use `has-shipit-label` today. Grep again before deleting the wrapper.

# Scripter Plan: Auto-next: skill wiring

Main plan: [plan.md](plan.md)

## Shared contracts

You produce:
- `github.sh has-label` exit codes `0` (has label), `1` (no label / usage error), `2` (could not determine). See [plan.md](plan.md#shared-contracts).
- `auto-plan-issue/scripts/auto_next.sh <repo_path> <id>`, which prints `CHAIN=yes|no` and `REASON=branch|config|push`, exactly as specified in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — `has-label` exit 2 on lookup failure (shell path)
In `auto-fix-all/scripts/github_shell.sh` `cmd_has_label`, keep the usage error at exit `1`. Exit `2` when any lookup step fails: `_ensure_gh_user`, `get_repo_ref`, or `gh issue view ... --json labels` (today `|| exit 1`). Under `set -e` these currently exit `1` implicitly, so each needs an explicit `|| exit 2`. Keep the final `grep -qixF`: match → `0`, no match → `1`. Update the header and usage text in `github_shell.sh` and `github.sh` to document exit `2`.

### Step 2 — `auto-plan-issue/scripts/auto_next.sh`
Create the script following the contract in [plan.md](plan.md#shared-contracts). It is plain bash, with `set -euo pipefail` handled around the git and prompt calls. It calls `next_step_prompt.sh` resolved as `"${SCRIPT_DIR}/../../arcanum/_lib/next_step_prompt.sh"`, lets that script's stderr through untouched, and parses `CHOICE=` from its stdout. Keep the script's own stdout to `key=value` lines only, and send the `git push` output to stderr. Put the header comment in the same style as `commit_plan.sh`.

## Files to Change
- `auto-fix-all/scripts/github_shell.sh`: exit `2` when labels cannot be determined; header and usage text.
- `auto-fix-all/scripts/github.sh`: header comment documents exit `2`.
- `auto-plan-issue/scripts/auto_next.sh`: new.

## Notes
- Tests for both scripts live in `core/spec/bin/` and are written by `node`.

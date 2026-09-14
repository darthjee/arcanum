# Issue: Fix 6 standalone SC2034 findings across scripts and libs

## Description

Part of #464 (Sweep unused shell variables flagged by ShellCheck SC2034). Codacy's ShellCheck flags 6 standalone SC2034 ("appears unused") findings, each in a different file/script family, unrelated to the `LOCK_FILE`/`REPO_PATH`/`MIGRATIONS_SCRIPT_DIR` clusters covered by this issue's sibling sub-issues (#472, #473, #476, #477).

## Problem

Unlike the clustered findings, each of these 6 is a one-off. Pre-discussion verification (grepping each variable's usage in its own file and across every script that sources it) already settled unused-vs-consumed for all 6, so the fix per location is now known rather than left as an open investigation:

- 3 are genuinely dead assignments, safe to remove outright.
- 3 are consumed by sourcing callers and must be kept, each suppressed with a `# shellcheck disable=SC2034` comment naming its consumer(s).

## Solution

Work should be delegated to the `scripter` agent, since all affected files are under `<skill>/scripts/` or `arcanum/_lib/`. Apply exactly the following per location — no further investigation needed:

1. `auto-fix-all/scripts/config_common.sh:13` — `NAMESPACE="auto-fix-all"`. **Keep** — read via `$NAMESPACE` by 4 sourcing callers (`auto-fix-all/scripts/config_toggle_shell.sh`, `config_is_enabled_shell.sh`, `config_get_shell.sh`, `config_set_shell.sh`). Add `# shellcheck disable=SC2034 # consumed by config_{toggle,is_enabled,get,set}_shell.sh` above the assignment.
2. `auto-monitor-issue-pr/scripts/resolve_pr_number.sh:23` — `ID="${2:-}"`. **Remove** — this is a thin `engine_dispatch` shim; it forwards the original `"$@"` unchanged to `engine_dispatch`, so the `ID` variable itself is never read anywhere. Delete the assignment line.
3. `arcanum-update/scripts/run_update_common.sh:42` — `REPO="$(parse_github_owner_repo "$TARGET_PATH" || true)"`. **Keep** — `REPO` is one of `resolve_target`'s documented module-level output globals, read by `run_update_check_shell.sh` (`echo "REPO=${REPO}"`). Add `# shellcheck disable=SC2034 # consumed by run_update_check_shell.sh` above this assignment.
4. `init-claude/scripts/lib/label_config.sh:67` — `DEFAULT_LABEL_CONFIG_PATH=".claude/state/init-claude-config.json"`. **Keep** — read via `$DEFAULT_LABEL_CONFIG_PATH` by `init-claude/scripts/sync_labels.sh` (both in its usage/help text and as its `CONFIG_PATH` default). Add `# shellcheck disable=SC2034 # consumed by sync_labels.sh` above the assignment.
5. `arcanum/_lib/merge_body.sh:74` — `local repo_path="$1" ...` inside `merge_body_coauthors_list`. **Keep** — this is a function parameter, not a sourced global; the function's own docstring already documents it as "accepted but unused, kept only for signature consistency with every other arcanum script's repo-path-first-arg convention." Add `# shellcheck disable=SC2034 # kept for repo-path-first-arg signature consistency (see docstring above); not read` on the `local` line, rather than a comment naming a "consumer" (there isn't one).
6. `init-claude/scripts/lib/label_config.sh:185` — `local pair existing_name skip found` inside `label_config_remove`. **Remove** — only `found` is ever assigned/read in this loop; `skip` is leftover and untouched anywhere in the function. Drop `skip` from the `local` declaration.

## Acceptance Criteria

- All 6 standalone SC2034 findings above are resolved per the specific action listed (removed, or suppressed with a comment naming the reason/consumer).
- No existing script behavior changes.
- Re-running ShellCheck/Codacy on the affected files shows zero SC2034 findings among these 6 locations.

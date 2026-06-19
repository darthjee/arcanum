# Plan: Move more monitor-PR logic into the script

Issue: [5-move-more-monitor-pr-logic-into-the-script.md](../../issues/5-move-more-monitor-pr-logic-into-the-script.md)

## Overview

Add a `monitor <issue_id>` command to `auto-fix-all/scripts/monitor_pr.sh` that internally resolves the PR number and PR owner and derives the since-file path, then runs the existing blocking poll loop — collapsing the current three-call sequence in `monitor_pr.md` into one.

## Context

`monitor_pr.sh` currently only accepts `<pr_number> <pr_owner> <since_file>` positionally and contains a self-contained copy of the origin-resolution helpers (`_load_origin`, `get_repo_ref`, `get_gh_user`, `_ensure_gh_user` — duplicated from `github.sh` by design, no cross-script sourcing in this repo). The new `monitor` subcommand reuses those same helpers (already present in the file) to resolve `pr_number` (mirroring `auto-fix-all/scripts/github.sh`'s `cmd_pr_number`, which calls `gh pr view -R "$repo_ref" "$branch" --json number -q '.number'`) and `pr_owner` (`git config user.ghuser`).

## Implementation Steps

### Step 1 — Add command dispatch to `monitor_pr.sh`

Currently the script reads its three positional args directly (`PR_NUMBER="${1:-}"`, `PR_OWNER="${2:-}"`, `SINCE_FILE="${3:-}"`) with no subcommand concept. Refactor so the script recognizes two forms:
- `monitor_pr.sh monitor <issue_id>` — new form.
- `monitor_pr.sh <pr_number> <pr_owner> <since_file>` — existing form, must keep working unchanged (other call sites, if any, are unaffected).

Distinguish by checking whether `$1` is literally `monitor`.

### Step 2 — Implement the resolution logic for the `monitor` form

When invoked as `monitor_pr.sh monitor <issue_id>`:
- `PR_OWNER=$(git config user.ghuser 2>/dev/null || git config --global user.ghuser 2>/dev/null || true)` (mirror `get_gh_user` from `github.sh`, already duplicated in this file as `get_gh_user`).
- Resolve `PR_NUMBER` the same way `cmd_pr_number` does in `auto-fix-all/scripts/github.sh`: `branch=$(git branch --show-current)`, `repo_ref=$(get_repo_ref)` (already present in this file), `gh pr view -R "$repo_ref" "$branch" --json number -q '.number'`. Error out clearly if no PR is found.
- `SINCE_FILE=".claude/state/auto-fix-all-${issue_id}-since.txt"`.
- Fall through into the same blocking loop already implemented (no duplication — just set the three variables before entering the existing `while true; do ... done` loop).

### Step 3 — Update usage/help text and header comment

Reflect both invocation forms in the script's top-of-file comment block and in any usage-error message.

### Step 4 — Update `auto-fix-all/steps/monitor_pr.md`

Replace the "Resolve the PR number and owner" section and the "Block on the monitor script" section's three-call sequence with a single call:
```bash
scripts/monitor_pr.sh monitor <id>
```
Keep the rest of the file (interpretation of `merged`/`closed`/`approved`/`commented`) unchanged — only the invocation changes.

## Files to Change

- `auto-fix-all/scripts/monitor_pr.sh`
- `auto-fix-all/steps/monitor_pr.md`

## Notes

- No CI config exists in this repo, so no `## CI Checks` section applies; verification is manual (run the script against a real PR/branch, as already done for issue #4's pipeline run).
- This is a self-contained script change with no agent split needed (only `scripter`-scoped work).

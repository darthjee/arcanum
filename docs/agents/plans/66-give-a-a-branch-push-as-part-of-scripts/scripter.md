# Scripter Plan: Give a branch push as part of scripts

Main plan: [plan.md](plan.md)

## Shared contracts

Create `_lib/push.sh` as a sourceable library (no shebang `exec`; only function definitions). It must define:

```bash
push_current_branch() {
  local branch
  branch=$(git branch --show-current)
  git push -u origin "${branch}:${branch}"
}
```

- No arguments.
- Idempotent: `git push -u origin <branch>:<branch>` exits 0 even if nothing new to push.
- Sourced by each script via: `source "${SCRIPT_DIR}/../../_lib/push.sh"` (scripts are two levels below the repo root).

## Implementation Steps

### Step 1 — Create `_lib/push.sh`

Create `_lib/push.sh` in the repo root's `_lib/` directory. Model the file header after `_lib/origin.sh` (a comment block declaring this is a sourceable library, not an executable). Define `push_current_branch` as described above.

Do not add `set -euo pipefail` at the top — the sourcing script already has it set, and adding it again from a sourced file can cause issues. Do include a guard to ensure the file is sourced rather than executed (optional but good practice).

### Step 2 — Update `auto-fix-issue/scripts/commit_change.sh`

Add a `SCRIPT_DIR` computation right after `set -euo pipefail` (it currently has none):

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/push.sh"
```

Then, after the `git commit -F -` pipeline at the bottom of the script, add:

```bash
push_current_branch
```

### Step 3 — Update `auto-new-issue/scripts/commit_issue.sh`

Same pattern: add `SCRIPT_DIR` and `source "${SCRIPT_DIR}/../../_lib/push.sh"` after `set -euo pipefail`, then call `push_current_branch` after the `git commit -F -` at the bottom.

### Step 4 — Update `auto-plan-issue/scripts/commit_plan.sh`

Same pattern as Step 3.

### Step 5 — Update `auto-fix-all/scripts/cleanup_artifacts.sh`

Same pattern: add `SCRIPT_DIR` and `source "${SCRIPT_DIR}/../../_lib/push.sh"` after `set -euo pipefail`. Call `push_current_branch` right after the `git commit -F -` at the bottom (which already only runs when something was staged — the existing `git diff --cached --quiet` guard keeps it correct).

### Step 6 — Update `auto-fix-all/scripts/reply_comment.sh`

This script already has a `SCRIPT_DIR` computation. Two changes:

1. Fix the broken `_lib_origin.sh` source (left over from the #67 refactoring — the file no longer exists):
   Replace:
   ```bash
   source "${SCRIPT_DIR}/_lib_origin.sh"
   ```
   With:
   ```bash
   source "${SCRIPT_DIR}/../../_lib/origin.sh"
   ```

2. Add a source for `_lib/push.sh` immediately after:
   ```bash
   source "${SCRIPT_DIR}/../../_lib/push.sh"
   ```

3. At the very end of the script (after the `gh pr comment` call), add:
   ```bash
   push_current_branch
   ```

### Step 7 — Update `auto-monitor-pr/scripts/monitor_pr.sh`

This script already sources `../../_lib/origin.sh`. Add the push helper source immediately after it:

```bash
source "${SCRIPT_DIR}/../../_lib/push.sh"
```

Then, inside the `while true` loop, before the first `gh pr view` call (i.e., as the very first line of the loop body), add:

```bash
push_current_branch 2>/dev/null || true
```

The `|| true` is intentional: this is a defensive best-effort push. If the branch has no upstream yet (e.g. the script was invoked before the initial push), the push will fail gracefully without aborting the monitor loop.

## Files to Change

- `_lib/push.sh` — create new sourceable library
- `auto-fix-issue/scripts/commit_change.sh` — add SCRIPT_DIR + source + push call
- `auto-new-issue/scripts/commit_issue.sh` — add SCRIPT_DIR + source + push call
- `auto-plan-issue/scripts/commit_plan.sh` — add SCRIPT_DIR + source + push call
- `auto-fix-all/scripts/cleanup_artifacts.sh` — add SCRIPT_DIR + source + push call
- `auto-fix-all/scripts/reply_comment.sh` — fix broken source path, add push source + call
- `auto-monitor-pr/scripts/monitor_pr.sh` — add push source + defensive call in loop

## Notes

- After this implementation, `_lib/push.sh` must have execute permission (`chmod +x`) only if it is ever executed directly; since it is sourced, it does not strictly need it. Follow the convention in `_lib/` (the origin.sh file was not executable until issue #66 fixed permissions). Leave it non-executable for consistency with the "sourceable, not executable" design.
- The `push_current_branch` function uses explicit `<branch>:<branch>` refspec rather than `HEAD` to avoid accidentally pushing a detached HEAD state or the wrong branch when the git checkout state is unexpected.

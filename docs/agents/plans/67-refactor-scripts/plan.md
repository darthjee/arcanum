# Plan: Refactor Scripts

Issue: [67-refactor-scripts.md](../issues/67-refactor-scripts.md)

## Overview

Eliminate code duplication across the project's scripts by extracting shared logic into `_lib/`. Five groups of duplicated code are targeted: `_lib_origin.sh` (4 copies), `github.sh` issue-fetch variant (2 copies), `resolve_id_and_file.sh` (2 copies), `resolve_plan_paths.sh` (2 copies), and lock acquisition boilerplate (5 consumers). In each case, one canonical copy moves to `_lib/`, and all consumers are updated to source from there.

## Context

The `_lib/` directory already exists with `tags.sh`, `tag_actions.sh`, and `tag_mutate.sh`. The refactor follows the same pattern already used by those files: a library file under `_lib/`, sourced via a relative path computed from `SCRIPT_DIR`.

## Implementation Steps

### Step 1 — Consolidate `_lib_origin.sh` into `_lib/origin.sh`

The four copies in `auto-fix-all/scripts/_lib_origin.sh`, `auto-monitor-issue-pr/scripts/_lib_origin.sh`, `auto-monitor-pr/scripts/_lib_origin.sh`, and `monitor-issues/scripts/_lib_origin.sh` differ only in their top comment. Write a single canonical `_lib/origin.sh` with a generic comment. Update each consumer to source it via its own `SCRIPT_DIR`:

- `auto-fix-all/scripts/github.sh` and `wait_ci.sh` source `_lib_origin.sh` — replace with `source "${SCRIPT_DIR}/../../_lib/origin.sh"`
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — same pattern (`../../../_lib/origin.sh` from its depth)
- `auto-monitor-pr/scripts/monitor_pr.sh` — same pattern
- `monitor-issues/scripts/monitor_issues.sh` already computes `SCRIPT_DIR` and sources `_lib_origin.sh` — update similarly

Remove the four old `_lib_origin.sh` files.

### Step 2 — Consolidate `github.sh` (issue-fetch variant) into `_lib/github_issue.sh`

`auto-new-issue/scripts/github.sh` and `discuss-issue/scripts/github.sh` are byte-for-byte identical. Move one to `_lib/github_issue.sh` and delete the other. Update the two consumers to invoke this canonical copy. Since these scripts are invoked directly (not sourced), the consumers that call `scripts/github.sh` inside their skill need to point to the new path. In practice, callers use the path relative to the skill folder — update those callers accordingly.

Check how each consumer calls its own `github.sh`: `auto-new-issue/steps/run.md` calls `scripts/github.sh fetch <id>` (relative to `auto-new-issue`) and `discuss-issue/steps/` calls `scripts/github.sh`. Both refer to the script via the `auto-new-issue` or `discuss-issue` skill folder. Replace both per-skill copies with a single canonical `_lib/github_issue.sh` and update all call-site references (in markdown steps and any scripts that invoke it) to the new relative path.

### Step 3 — Consolidate `resolve_id_and_file.sh` into `_lib/resolve_id_and_file.sh`

`auto-new-issue/scripts/resolve_id_and_file.sh` and `discuss-issue/scripts/resolve_id_and_file.sh` are identical. Move to `_lib/resolve_id_and_file.sh`, delete the per-skill copies, and update callers in `auto-new-issue/steps/run.md` and `discuss-issue/` to reference the new path.

### Step 4 — Consolidate `resolve_plan_paths.sh` into `_lib/resolve_plan_paths.sh`

`auto-fix-issue/scripts/resolve_plan_paths.sh` and `auto-plan-issue/scripts/resolve_plan_paths.sh` are identical. Move to `_lib/resolve_plan_paths.sh`, delete per-skill copies, and update callers in the `auto-fix-issue` and `auto-plan-issue` markdown steps.

### Step 5 — Extract lock acquisition into `_lib/lock.sh`

The `_acquire_lock`/`_release_lock` function pair is repeated verbatim in:
- `auto-fix-all/scripts/config.sh`
- `auto-fix-all/scripts/queue.sh`
- `monitor-issues/scripts/config.sh`
- `monitor-issues/scripts/rewrite_queue.sh`
- `monitor-issues/scripts/monitor_issues.sh`

Create `_lib/lock.sh` that defines `_acquire_lock` and `_release_lock` as re-usable functions. Each consumer already has its own `LOCK_FILE` variable, so `_acquire_lock` can reference `$LOCK_FILE` from the caller's scope (same pattern the functions already use). Update each consumer to source `_lib/lock.sh` and remove its inline `_acquire_lock`/`_release_lock` definitions.

Note: `monitor_issues.sh` uses a module-level `_LOCK_INSTANCE_ID` variable pre-computed once and reused across calls. The `config.sh` and `queue.sh` copies compute the instance ID inside `_acquire_lock` locally. The shared `_lib/lock.sh` should support both patterns — either define `_LOCK_INSTANCE_ID` externally (caller sets it before sourcing) or compute it inside the function if not already set.

## Files to Change

- `_lib/origin.sh` — new canonical file (from `_lib_origin.sh` copies)
- `_lib/github_issue.sh` — new canonical file (from `auto-new-issue/scripts/github.sh`)
- `_lib/resolve_id_and_file.sh` — new canonical file (from `auto-new-issue/scripts/resolve_id_and_file.sh`)
- `_lib/resolve_plan_paths.sh` — new canonical file (from `auto-fix-issue/scripts/resolve_plan_paths.sh`)
- `_lib/lock.sh` — new shared lock helpers
- `auto-fix-all/scripts/_lib_origin.sh` — deleted
- `auto-fix-all/scripts/github.sh` — update source path
- `auto-fix-all/scripts/wait_ci.sh` — update source path
- `auto-fix-all/scripts/config.sh` — source `_lib/lock.sh`, remove inline lock functions
- `auto-fix-all/scripts/queue.sh` — source `_lib/lock.sh`, remove inline lock functions
- `auto-monitor-issue-pr/scripts/_lib_origin.sh` — deleted
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — update source path
- `auto-monitor-pr/scripts/_lib_origin.sh` — deleted
- `auto-monitor-pr/scripts/monitor_pr.sh` — update source path
- `auto-new-issue/scripts/github.sh` — replaced by symlink or stub to `_lib/github_issue.sh`, or callers updated
- `auto-new-issue/scripts/resolve_id_and_file.sh` — deleted, callers updated
- `discuss-issue/scripts/github.sh` — deleted, callers updated
- `discuss-issue/scripts/resolve_id_and_file.sh` — deleted, callers updated
- `auto-fix-issue/scripts/resolve_plan_paths.sh` — deleted, callers updated
- `auto-plan-issue/scripts/resolve_plan_paths.sh` — deleted, callers updated
- `monitor-issues/scripts/_lib_origin.sh` — deleted
- `monitor-issues/scripts/config.sh` — source `_lib/lock.sh`, remove inline lock functions
- `monitor-issues/scripts/rewrite_queue.sh` — source `_lib/lock.sh`, remove inline lock functions
- `monitor-issues/scripts/monitor_issues.sh` — update source paths for `_lib_origin.sh` and lock

## Notes

- Callers of `github.sh` in the `auto-new-issue` and `discuss-issue` skills invoke it via a relative path from their skill folder (e.g. `scripts/github.sh fetch <id>`). When the canonical copy moves to `_lib/github_issue.sh`, the caller invocation paths in markdown steps must be updated, or thin wrapper stubs kept in each skill's `scripts/` folder. Prefer thin wrappers if markdown steps cannot be easily patched (to avoid breaking the manual `/new-issue`/`/discuss-issue` skills that read those paths).
- Similarly for `resolve_id_and_file.sh` and `resolve_plan_paths.sh` — the markdown steps in `auto-new-issue/steps/run.md`, `discuss-issue/steps/`, `auto-fix-issue/steps/run.md`, `auto-plan-issue/steps/run.md` reference these scripts by skill-relative path. Either update those references or add thin wrapper stubs.
- The lock.sh extraction must preserve the existing warning behavior (10-attempt threshold, single warning per acquisition).
- No behavioral change is expected — this is a pure refactor; all outputs and exit codes remain identical.

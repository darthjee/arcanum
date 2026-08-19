# Scripter Plan: auto-plan-issue should break down plans

Main plan: [plan.md](plan.md)

## Shared contracts

`skill-writer`'s updated `auto-fix-issue/steps/dispatch_agents.md` and `steps/review_and_redispatch.md` reference a new script by this exact name and contract — build it precisely:

- **Path**: `auto-fix-issue/scripts/list_plan_steps.sh`
- **Usage**: `list_plan_steps.sh <plan_dir> <agent_name>`
- **Behavior**:
  - `<plan_dir>/<agent_name>/` does not exist as a directory → print nothing, exit 0.
  - It exists → list every `*.md` file directly inside it (no recursion), one per line, sorted alphabetically, each printed as `<plan_dir>/<agent_name>/<file>`.
- Never errors on a missing `<plan_dir>` or missing `<agent_name>` subfolder — absence just means "this agent's plan is inline, not split," the same semantics `list_plan_agents.sh` already uses for a missing/empty `<plan_dir>`.

## Implementation Steps

### Step 1 — Add `list_plan_steps.sh`

Create `auto-fix-issue/scripts/list_plan_steps.sh`, modeled directly on the existing `auto-fix-issue/scripts/list_plan_agents.sh` (same `set -euo pipefail`, `shopt -s nullglob` + `sort` pattern), but:

- Takes two arguments instead of one: `<plan_dir>` and `<agent_name>`.
- Globs `"$PLAN_DIR/$AGENT_NAME"/*.md` instead of `"$PLAN_DIR"/*.md`.
- Does **not** exclude any filename (there's no `plan.md`-equivalent to skip inside a step subfolder — every `*.md` file there is a real step).
- Prints the full relative path per line (`<plan_dir>/<agent_name>/<file>`), not just the basename — `list_plan_agents.sh` prints bare agent names because the caller already knows `PLAN_DIR`; here the caller (an executing specialist agent) needs the ready-to-read path directly, per [dispatch_agents.md](../../../../auto-fix-issue/steps/dispatch_agents.md)'s per-step read loop.
- Guards the missing-directory case explicitly with `[[ -d "$PLAN_DIR/$AGENT_NAME" ]] || exit 0` before the glob, mirroring `list_plan_agents.sh`'s `[[ -d "$PLAN_DIR" ]] || exit 0` guard.

Add a usage-header comment in the same style as `list_plan_agents.sh`'s (a `# Usage:` line plus a short behavior description), and a `Usage: $0 <plan_dir> <agent_name>` error message on missing arguments.

## Files to Change
- `auto-fix-issue/scripts/list_plan_steps.sh` — new script, list a specialist agent's ordered step files.

## Notes
- No test harness exists for these bash scripts in this repo (no shellcheck/bats CI job) — verify manually by creating a scratch `<plan_dir>/<agent_name>/{01,02}-x.md` fixture and checking the script's output order and the missing-directory exit-0 case.

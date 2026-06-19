# Plan: Extract scripts for checks

Issue: [9-extract-scripts-for-checks.md](../../issues/9-extract-scripts-for-checks.md)

## Overview

Add a script that runs an agent's check script (`.claude/scripts/check_<agent>.sh` in the target project) if one exists, falling back cleanly when it doesn't. Wire it into `auto-fix-issue`'s development cycle instead of relying on prose-described commands. Update `init-claude` to generate these per-agent check scripts when agents are set up.

## Context

- `init-claude/SKILL.md` already runs `setup_agents.md` as its last step (Step 8) — the "move agents definition to the end" part of the issue is already satisfied; no reordering needed.
- `init-claude/setup_agents.md` Step 3 already gathers, per specialist agent, "Commands — how to run tests/lint/build for this scope" — the data is already collected, it's just never turned into a script. Step 6 ("Write the agent files") is where script generation should be added.
- `auto-fix-issue/steps/dispatch_agents.md`'s instruction to each dispatched agent currently says: "Run tests and lint/fix (using the commands documented in your own agent instructions, or in the plan's `## CI Checks` section when present)." This is the prose reference to replace with a call to the new script.
- This repo (Arcanum itself) has no `.claude/scripts/` directory and no test/lint commands of its own (pure markdown + bash skills, no test suite) — the new script's "no script found → no tests needed" fallback is exactly what applies when `auto-fix-issue` runs inside Arcanum's own repo, as it has throughout this session's pipeline runs.

## Implementation Steps

### Step 1 — Add `auto-fix-issue/scripts/run_checks.sh`

A new script: `run_checks.sh <agent>`.
- Look for `.claude/scripts/check_<agent>.sh` relative to the current working directory (the target project).
- If found and executable (or made executable), run it, streaming its output, and exit with its exit code.
- If not found, print something like `No checks configured for agent '<agent>' — skipping.` and exit 0 (success — "no tests needed" must never look like a failure).

### Step 2 — Wire it into `auto-fix-issue/steps/dispatch_agents.md`

Replace the development-cycle's step 2 ("Run tests and lint/fix (using the commands documented in your own agent instructions, or in the plan's `## CI Checks` section when present)") with an instruction to run:
```bash
scripts/run_checks.sh <agent-name>
```
(resolved relative to the `auto-fix-issue` skill folder), where `<agent-name>` is the dispatched agent's own name (the same value used as `subagent_type`). If it exits non-zero, fix the reported failure and re-run before continuing to step 3 (refactor analysis). Keep the plan's `## CI Checks` section as a secondary source of context for agents investigating a failure, but the script is now the actual thing that gets executed.

For the "no output (empty), implement it yourself" case in `SKILL.md` Step 3 (the architect handling an unsplit plan), the architect should call `scripts/run_checks.sh architect`, consistent with the same mechanism.

### Step 3 — Update `init-claude/setup_agents.md`

In Step 6 ("Write the agent files"), after writing `.claude/agents/<agent-name>.md` for each specialist agent, also write `.claude/scripts/check_<agent-name>.sh` (creating `.claude/scripts/` if needed) containing the command(s) gathered in Step 3 ("Commands"), wrapped as a simple executable script (`#!/usr/bin/env bash` + `set -euo pipefail` + the gathered command(s)), and `chmod +x` it. Do not generate a check script for the `architect` coordinator unless the user explicitly gave it its own check command (architect typically has none, since it doesn't own a stack-specific test suite — but don't hardcode this assumption rigidly; ask if unclear). Update Step 7's confirmation message to also list the generated `.claude/scripts/check_<agent>.sh` files.

### Step 4 — Manual verification

Test `run_checks.sh` against both cases (a `.claude/scripts/check_<agent>.sh` that exists vs. one that doesn't) in a scratch directory, confirming exit codes and output behave as specified.

## Files to Change

- `auto-fix-issue/scripts/run_checks.sh` (new)
- `auto-fix-issue/steps/dispatch_agents.md`
- `auto-fix-issue/SKILL.md` (Step 3's "implement it yourself" bullet, to reference the architect's own check script call)
- `init-claude/setup_agents.md`

## Notes

- No CI config or test suite exists in Arcanum itself; verification is manual, per Step 4.
- `init-claude/SKILL.md`'s step ordering needs no change — confirmed already correct.
- This is script + prose work; the script part should go through the `scripter` agent per this repo's convention, the prose parts through the architect.

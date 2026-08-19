# Plan: auto-plan-issue should break down plans

Issue: [215-auto-plan-issue-should-break-down-plans.md](../../issues/215-auto-plan-issue-should-break-down-plans.md)

## Overview

`auto-plan-issue` and `plan-issue` currently write each specialist agent's implementation plan as a single `<agent-name>.md` file with every step's description and file list inline under `## Implementation Steps`. This plan splits an agent's plan across multiple files whenever it has more than 2 steps: `<agent-name>.md` becomes an index (shared contracts, an ordered list of step links, CI checks, notes), and each step moves to its own numbered, self-contained file under `<agent-name>/`. `auto-fix-issue`'s dispatch and re-dispatch instructions are updated to consume the new shape one step at a time.

## Agents involved

- [skill-writer](skill-writer.md)
- [scripter](scripter.md)

## Shared contracts

A new script, `auto-fix-issue/scripts/list_plan_steps.sh`, is added by `scripter` and referenced by `skill-writer`'s updated `dispatch_agents.md`/`review_and_redispatch.md` prose:

- **Usage**: `list_plan_steps.sh <plan_dir> <agent_name>`
- **Behavior**: mirrors the existing `list_plan_agents.sh` pattern (nullglob + sort).
  - If `<plan_dir>/<agent_name>/` does not exist as a directory: prints nothing, exits 0 — signals "this agent's plan is inline, not split."
  - If it exists: lists every `*.md` file directly inside it, one per line, sorted alphabetically (the zero-padded numeric prefix, e.g. `01-`, `02-`, makes alphabetical sort equal execution order), printed as the relative path `<plan_dir>/<agent_name>/<file>`.
- **Exit code**: always 0 on a successful listing (empty or not) — the same "prints nothing on absence, never errors" contract `list_plan_agents.sh` already uses for a missing `<plan_dir>`.

Both the step-file naming convention (`<NN>-<slug>.md`, zero-padded two-digit number) and the split threshold (split only when an agent's plan has **more than 2 steps**; 1–2 steps stay inline in `<agent-name>.md`) are conventions `skill-writer` bakes into the prose of `write_plan.md`/`write_and_confirm.md`, and that `scripter`'s script relies on for correct sort order — no separate script enforces the threshold or the naming; it's a judgment call made while drafting the plan, same as the existing `AGENT_SPLIT` decision.

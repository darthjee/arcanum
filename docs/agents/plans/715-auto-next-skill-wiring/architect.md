# Architect Plan: Auto-next: skill wiring

Main plan: [plan.md](plan.md)

## Shared contracts

Document the contracts in [plan.md](plan.md#shared-contracts) as implemented. Do not invent behaviour beyond them.

## Implementation Steps

### Step 1 — `skill-finish.md`
In `docs/agents/architecture/skill-finish.md`:
- remove the "until #715 ... every offer still prompts" note (around line 126);
- in the Next-step map, change the `discuss-issue` / `plan-issue` / `auto-plan-issue` next command to `/loop /auto-resolve-issue <id>`, and add an "Auto key" column (`next_step.auto.<skill>`, or `-`);
- add notes covering: the enhance-issue Epic rule (fail-safe on `has-label` exit 2); a top-level `auto-plan-issue` chaining through `auto_next.sh` (HEAD must be `issue-<id>`, and the plan is pushed before chaining); and nested runs never chaining.

### Step 2 — Spec and related docs
- `docs/agents/specs/skill-auto-next.md`: mark #715's part as implemented and record the refinements: `/loop` in the offered command (manual `[Y]es` too), the push before a top-level `auto-plan-issue` chains, the fail-safe Epic check (`has-label` exit 2), and `auto_next.sh`.
- `docs/agents/architecture/issue-tags.md`: the `epic` paragraph documents `has-label` exit codes. Add exit `2` and enhance-issue's fail-safe use of it.

## Files to Change
- `docs/agents/architecture/skill-finish.md`: next-step map and notes.
- `docs/agents/specs/skill-auto-next.md`: refinements, status.
- `docs/agents/architecture/issue-tags.md`: `has-label` exit 2.

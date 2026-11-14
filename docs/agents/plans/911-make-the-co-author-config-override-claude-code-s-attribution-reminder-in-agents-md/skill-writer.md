# Skill-Writer Plan: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

Main plan: [plan.md](plan.md)

## Shared contracts

This agent calls `init-claude/scripts/ensure_coauthor_policy.sh "$REPO_PATH"`, which prints `COAUTHOR_POLICY=added|present|no-agents-md` (see [plan.md](plan.md#shared-contracts)).

## Implementation Steps

### Step 1 — Add the setup step

Add `init-claude/setup_coauthor_policy.md`. It runs the shim with `REPO_PATH`, resolved relative to the init-claude skill folder. It is silent and best-effort, like `setup_arcanum_version.md`:

- `added`: tell the user one line saying the commit-attribution line was added to AGENTS.md.
- `present` / `no-agents-md`: say nothing.
- A non-zero exit: say one line and continue.

It never asks the user anything.

### Step 2 — Wire it into SKILL.md

In `init-claude/SKILL.md`, insert the new step right after Step 3 (the scenario step), as "Setup commit attribution policy", and renumber the following steps. Alternatively, add it as a new step just before "Stamp the arcanum version", to avoid renumbering. Pick whichever keeps cross-references intact. Add the new step to the `REPO_PATH` threading sentence at the top. The 8 `scenario_*.md` files stay unchanged.

## Files to Change

- `init-claude/setup_coauthor_policy.md` — new step.
- `init-claude/SKILL.md` — call the step and list it in the `REPO_PATH` threading note.

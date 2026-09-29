# Scripter Plan: Skill finish: remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- Comment target: `docs/agents/architecture/skill-finish.md` (produced by `architect`).
- Retarget rule: `docs/agents/specs/skill-finish.md` becomes `docs/agents/architecture/skill-finish.md`. Remove `docs/agents/plans/660-skill-finish-discuss-issue/plan.md`, which no longer exists.

## Implementation Steps

### Step 1 — Retarget header comments in the finish scripts

Update only the header comments. Change no code.

- `arcanum/_lib/finish_report.sh`: "see docs/agents/specs/skill-finish.md, docs/agents/architecture/script-engine.md and docs/agents/plans/660-…/plan.md for the full design/shared contracts" becomes "see docs/agents/architecture/skill-finish.md and docs/agents/architecture/script-engine.md for the full design/contracts".
- `arcanum/_lib/finish_report_shell.sh`: same rewrite (it lists `script-engine.md` first, then the spec, then the plan).
- `arcanum/_lib/next_step_prompt.sh`: "see docs/agents/specs/skill-finish.md and docs/agents/plans/660-…/plan.md" becomes "see docs/agents/architecture/skill-finish.md".

Re-wrap the comment lines to keep the current width.

## Files to Change

- `arcanum/_lib/finish_report.sh`: header comment.
- `arcanum/_lib/finish_report_shell.sh`: header comment.
- `arcanum/_lib/next_step_prompt.sh`: header comment.

## Notes

- Comment-only change. Run `shellcheck` on the three files as a sanity check.

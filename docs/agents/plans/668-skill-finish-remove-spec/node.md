# Node Plan: Skill finish: remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- Comment target: `docs/agents/architecture/skill-finish.md` (produced by `architect`).
- Retarget rule: `docs/agents/specs/skill-finish.md` becomes `docs/agents/architecture/skill-finish.md`. Remove `docs/agents/plans/660-skill-finish-discuss-issue/plan.md`, which no longer exists.

## Implementation Steps

### Step 1 — Retarget comments in FinishReport and its parity spec

Change comments only, no code.

- `core/lib/commands/shared/FinishReport.js`: in the class JSDoc, "described in docs/agents/specs/skill-finish.md" becomes "described in docs/agents/architecture/skill-finish.md".
- `core/spec/bin/finishReportParity_spec.js`: in the header comment, keep the `script-engine.md` reference, replace the spec path with `docs/agents/architecture/skill-finish.md`, and drop the `docs/agents/plans/660-skill-finish-discuss-issue/plan.md's "Shared contracts"` reference. Re-wrap the lines.

## Files to Change

- `core/lib/commands/shared/FinishReport.js`: JSDoc comment.
- `core/spec/bin/finishReportParity_spec.js`: header comment.

## CI Checks

- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn test` (CI job: `test`)

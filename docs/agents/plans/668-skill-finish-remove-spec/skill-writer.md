# Skill-writer Plan: Skill finish: remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- Link target: `docs/agents/architecture/skill-finish.md#nested-runs` (produced by `architect`).

## Implementation Steps

### Step 1 — Retarget the nested-runs links in auto-fix-all

`auto-fix-all/steps/process_one_issue.md` has three identical references, in the new-issue, plan and fix phases (around lines 46, 58 and 73):

```markdown
(see "Nested runs" in [docs/agents/specs/skill-finish.md](../../docs/agents/specs/skill-finish.md))
```

Replace each one with:

```markdown
(see "Nested runs" in [Skill Finish](../../docs/agents/architecture/skill-finish.md#nested-runs))
```

Leave the rest of the prose unchanged.

## Files to Change

- `auto-fix-all/steps/process_one_issue.md`: retarget the 3 links.

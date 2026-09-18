# skill-writer Plan: Codacy: markdownlint MD041 cluster — first line should be a top-level heading (40 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — independent of architect's work.

## Implementation Steps

### Step 1 — Add a top-level heading to the 7 genuinely headingless files

Add a `# Title` line (plus a following blank line) as the very first line of each file, matching the heading style already used by sibling files in the same skill (e.g. `discuss-issue/steps/discuss_and_save.md` already starts with `# Discuss and Save Issue`):

- `arcanum/migrations/repos/0.13.0/002.instructions.md`
- `auto-fix-issue/steps/run.md`
- `auto-monitor-issue-pr/steps/run.md`
- `auto-monitor-pr/steps/run.md`
- `auto-new-issue/steps/run.md`
- `auto-plan-issue/steps/run.md`
- `auto-rewrite-issue/steps/run.md`

## Files to Change

- `arcanum/migrations/repos/0.13.0/002.instructions.md` — add a heading describing that migration step's purpose.
- `auto-fix-issue/steps/run.md` — add a heading describing this skill's run step (e.g. `# Autonomously Implement a Planned Issue`).
- `auto-monitor-issue-pr/steps/run.md` — add a heading describing this skill's run step.
- `auto-monitor-pr/steps/run.md` — add a heading describing this skill's run step.
- `auto-new-issue/steps/run.md` — add a heading describing this skill's run step.
- `auto-plan-issue/steps/run.md` — add a heading describing this skill's run step.
- `auto-rewrite-issue/steps/run.md` — add a heading describing this skill's run step.

## Notes

- Keep each heading short and specific to that file's actual content — mirror the sibling step-file heading conventions within the same skill folder rather than reusing one generic title across all 7 files.

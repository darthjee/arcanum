# Skill Writer Plan: Codacy: markdownlint MD060 — auto-fix-issue/steps/run.md (1 finding)

Main plan: [plan.md](plan.md)

## Overview

Fix the single `markdownlint_MD060` finding Codacy reports for `auto-fix-issue/steps/run.md`.

## Context

`.markdownlint.json` configures MD060 with `"style": "compact"`, meaning every table pipe must have exactly one space between it and the cell content. In `auto-fix-issue/steps/run.md`, the resume-step table ("Recorded value | Step completed | Resume from") already uses that style in its header and body rows, but its delimiter row on line 22 is `|---|---|---|`, with no spaces.

## Implementation Steps

### Step 1 — Reformat the delimiter row

In `auto-fix-issue/steps/run.md`, change line 22 from:

```markdown
|---|---|---|
```

to:

```markdown
| --- | --- | --- |
```

Leave every other line of the table and the file unchanged. The rendered table stays identical.

## Files to Change

- `auto-fix-issue/steps/run.md` — add spaces around the pipes in the table's delimiter row (line 22).

## Notes

- Do not modify `.markdownlint.json`.
- No markdownlint job runs in CI (`.circleci/config.yml` only runs `yarn lint` for `core/`). If available, `npx markdownlint-cli auto-fix-issue/steps/run.md` can verify the fix locally; otherwise Codacy confirms it on the PR.
- This is the only `|---|` delimiter row in the `auto-fix-issue` skill.

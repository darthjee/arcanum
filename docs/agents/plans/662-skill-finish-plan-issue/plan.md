# Plan: Skill finish: plan-issue

Issue: [662-skill-finish-plan-issue.md](../../issues/662-skill-finish-plan-issue.md)

## Overview
Give `plan-issue` the standard finish from `docs/agents/specs/skill-finish.md`. Once the user confirms the plan, `plan-issue` commits and pushes the plan on `issue-<id>` and swaps `Refined` → `Ready`. Every exit path then ends with a `finish_report.sh` report, and on success the skill offers `/auto-fix-issue <id>` through `next_step_prompt.sh`. All changes are to `plan-issue`'s skill markdown.

See [skill-writer.md](skill-writer.md) for the full plan.

# Plan: Skill finish: auto-fix-issue

Issue: [666-skill-finish-auto-fix-issue.md](../../issues/666-skill-finish-auto-fix-issue.md)

## Overview
Make every exit of `auto-fix-issue` end with the standard closing report from `docs/agents/specs/skill-finish.md` (via `arcanum/_lib/finish_report.sh`), support `NESTED=true`, and make `auto-fix-all` run it nested. This follows #665's change to `auto-plan-issue`. All the work is in skill markdown, owned by `skill-writer`.

See [skill-writer.md](skill-writer.md) for the full plan.

# Plan: Skill finish: auto-plan-issue

Issue: [665-skill-finish-auto-plan-issue.md](../../issues/665-skill-finish-auto-plan-issue.md)

## Overview
Make `auto-plan-issue` end every exit path with the standard closing report from `arcanum/_lib/finish_report.sh` (per `docs/agents/specs/skill-finish.md`), with `Next: /auto-fix-issue <id>` on success, and support `NESTED=true`. Make `auto-fix-all` pass `NESTED=true` when it runs `auto-plan-issue`. Markdown-only; the shared scripts already exist.

See [skill-writer.md](skill-writer.md) for the full plan.

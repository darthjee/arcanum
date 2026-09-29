# Plan: Skill finish: auto-new-issue

Issue: [664-skill-finish-auto-new-issue.md](../../issues/664-skill-finish-auto-new-issue.md)

## Overview

Make `auto-new-issue` end every exit path with the standard closing report from `arcanum/_lib/finish_report.sh`, ending in `Next: /auto-plan-issue <id>` on success. When run nested with `NESTED=true`, it returns the `FINISH_*` block instead of a report. `auto-fix-all` is updated to pass `NESTED=true`. This is markdown-only work owned by `skill-writer`.

See [skill-writer.md](skill-writer.md) for the full plan.

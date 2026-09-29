# Plan: Skill finish: enhance-issue

Issue: [661-skill-finish-enhance-issue.md](../../issues/661-skill-finish-enhance-issue.md)

## Overview
Make `enhance-issue` end with the standard closing report (`arcanum/_lib/finish_report.sh`) on every exit path, followed on success by the `/dev/tty` next-step offer for `/discuss-issue <id>` (`arcanum/_lib/next_step_prompt.sh`), per `docs/agents/specs/skill-finish.md`. This is a markdown-only change to the skill's step files.

See [skill-writer.md](skill-writer.md) for the full plan.

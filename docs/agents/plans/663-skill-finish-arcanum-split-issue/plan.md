# Plan: Skill finish: arcanum-split-issue

Issue: [663-skill-finish-arcanum-split-issue.md](../../issues/663-skill-finish-arcanum-split-issue.md)

## Overview
Wire every exit path of `arcanum-split-issue` to the shared closing report (`arcanum/_lib/finish_report.sh`) and, on success, to the shared `/dev/tty` next-step offer (`arcanum/_lib/next_step_prompt.sh`) with one `/enhance-issue <sub-id>` per newly created sub-issue, per `docs/agents/specs/skill-finish.md`. Only the skill's markdown steps change; no new scripts.

See [skill-writer.md](skill-writer.md) for the full plan.

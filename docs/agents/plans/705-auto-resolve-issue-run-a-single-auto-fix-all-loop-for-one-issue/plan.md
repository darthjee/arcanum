# Plan: auto-resolve-issue: run a single auto-fix-all loop for one issue

Issue: [705-auto-resolve-issue-run-a-single-auto-fix-all-loop-for-one-issue.md](../../issues/705-auto-resolve-issue-run-a-single-auto-fix-all-loop-for-one-issue.md)

## Overview

Add a new `/auto-resolve-issue <id>` skill: a single-issue coordinator that spawns an `architect` on the per-issue pipeline and reacts to its `OUTCOME=` (merged / pending / closed / blocked) with no queue. The per-issue steps (`process_one_issue.md`, `handle_comment.md`) move from `auto-fix-all/steps/` into `auto-resolve-issue/steps/`, and `auto-fix-all` becomes a queue wrapper that spawns the architect on that moved step. Every script, and the reply template, stays in `auto-fix-all`.

## Agents involved

- [skill-writer](skill-writer.md)
- [scripter](scripter.md)

## Shared contracts

- **Moved step paths** (single source of truth after this change):
  - `auto-resolve-issue/steps/process_one_issue.md` (was `auto-fix-all/steps/process_one_issue.md`). File name unchanged.
  - `auto-resolve-issue/steps/handle_comment.md` (was `auto-fix-all/steps/handle_comment.md`). File name unchanged.
- **Unchanged**: `process_one_issue.md`'s report protocol stays exactly `OUTCOME=merged`, `OUTCOME=closed PR_NUMBER=<n>`, `OUTCOME=blocked AGENT=<agent-name> ACTION=<description>`, or `OUTCOME=pending PR_NUMBER=<n>`. Both coordinators (`auto-fix-all`, `auto-resolve-issue`) parse it.
- **Scripts stay put**: every `auto-fix-all/scripts/*` (`github.sh`, `checkout_from_main.sh`, `cleanup_artifacts.sh`, `wait_ci.sh`, `wait_ci_and_merge.sh`, `reply_comment.sh`, `queue.sh`, `config.sh`, `*_shell.sh`) and `auto-fix-all/templates/reply.tmpl.md` keep their paths. No script signature, output contract, or Node command changes.

## Coordinator follow-up (architect, not dispatched)

The architect owns these root-level and `docs/agents/**` files and updates them directly once the specialists have committed:

- `README.md`: add a `/auto-resolve-issue` row to the skills table. Reword the `/auto-monitor-issue-pr` row's "Used by `auto-fix-all`" to mention `auto-resolve-issue`.
- `docs/agents/folder-structure.md`: add an `auto-resolve-issue/` row and adjust the `auto-fix-all/` row (queue wrapper around `auto-resolve-issue`'s per-issue step).
- `docs/agents/architecture/cross-skill-references.md`, `branch-bootstrap-and-merge-conflicts.md`, `dispatch-permissions.md`, `issue-tags.md`, `skill-finish.md`: repoint `auto-fix-all/steps/process_one_issue.md` and `auto-fix-all/steps/handle_comment.md` mentions to the new paths. Mention `auto-resolve-issue` wherever the doc lists the callers or coordinators of the per-issue pipeline.
- `.claude/agents/architect.md`: add `auto-resolve-issue` to the list of orchestration skills that spawn the architect.
- `docs/agents/tag-mutations.md` (and `docs/agents/tag-mutations.review.json` if the generator touches it): regenerate with `scripts/generate_tags_table.sh`, never by hand. The `fetched`/`working` rows move from `auto-fix-all` to `auto-resolve-issue`. Verify with `scripts/check_tags_table.sh`.
- Leave `arcanum/migrations/repos/**` untouched (historical records of past releases).

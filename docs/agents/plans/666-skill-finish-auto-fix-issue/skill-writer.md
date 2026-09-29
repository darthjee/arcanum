# Plan: Skill finish: auto-fix-issue

Issue: [666-skill-finish-auto-fix-issue.md](../../issues/666-skill-finish-auto-fix-issue.md)

## Overview
Wire `auto-fix-issue`'s exits to `arcanum/_lib/finish_report.sh`, add `NESTED=true` support, update the coordinator's relay wording in `SKILL.md`, and make `auto-fix-all/steps/process_one_issue.md` §4 run it nested. Use `auto-plan-issue/steps/run.md` (#665) as the template for wording and section layout.

## Context
- The spec is `docs/agents/specs/skill-finish.md`. `auto-fix-issue` is an **auto** skill: it never prompts and has no `declined` status. Its next step is `/auto-monitor-issue-pr <id>`, delivered as `--next` on success only.
- `finish_report.sh` resolves as `../arcanum/_lib/finish_report.sh` relative to the `auto-fix-issue` skill folder, the same base the existing `scripts/...` calls use.
- `scripts/github.sh pr-create` / `pr-ready` do a best-effort add of the `pr` tag (`_sync_pr_labels_and_state` in `auto-fix-issue/scripts/github_shell.sh`). Agreed in #666: pass `--label-change :pr` whenever `pr-create` or `pr-ready` ran in this run, even if the best-effort add warned. Don't pass it when the PR was already open and ready, or on resume from `pr_published`.
- `pr-create` / `pr-view` save `pr_id` (the PR number) and `pr_url` in `.claude/state/issue-<id>.json`. Read the number with `scripts/issue_state.sh "$REPO_PATH" get <id> pr_id` to pass as `--pr`.

## Steps

- [01 — Closing report, NESTED, and failed exits in run.md](skill-writer/01-run-md-closing-report.md)
- [02 — Success report in open_pr.md and SKILL.md relay wording](skill-writer/02-open-pr-and-skill-md.md)
- [03 — Run auto-fix-issue nested from auto-fix-all](skill-writer/03-auto-fix-all-nested.md)

## Notes
- Only `SKILL.md`/`steps/*.md` change. No new scripts: every deterministic part is already a script (`finish_report.sh`, `issue_state.sh`).
- Keep the report the last thing printed. Never hand-format or extend it.

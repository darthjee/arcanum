# Skill-writer Plan: Create-issue: skill files

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md#shared-contracts) for the exact signatures of `../scripts/start.sh`, `../scripts/publish.sh`, `finish_report.sh` and `next_step_prompt.sh`, the exit-4 rules, and the resolved open points. The exact `AskUserQuestion` wording for prompts 1, 5 and 6 is in the spec's "Exact `AskUserQuestion` wording" section ([`docs/agents/specs/arcanum-create-issue.md`](../../specs/arcanum-create-issue.md#exact-askuserquestion-wording)) and must be copied verbatim.

Key rules:

- The skill never touches git: no commit, no `checkout_safe_branch.sh`, no dirty-tree check, no `spawn_issue.sh`.
- `finish_report.sh` always with `--skill arcanum-create-issue`; applied labels go in the summary, never `--label-change`; no `--next`, no `--nested`.
- Every exit-4 (`FALLBACK=chat`) from `start.sh`, `publish.sh` and `next_step_prompt.sh` is handled with `AskUserQuestion`. No free-text chat yes/no, ever.
- No inline bash beyond single script calls (skill-reviewer must pass). A single `wc -l < <draft>` for prompt 5's body line count is acceptable; anything more must come back to the architect as a script request.

## Steps

- [01 — SKILL.md](skill-writer/01-skill-md.md)
- [02 — steps/start.md](skill-writer/02-start.md)
- [03 — steps/explore.md](skill-writer/03-explore.md)
- [04 — steps/dialogue.md](skill-writer/04-dialogue.md)
- [05 — steps/publish.md](skill-writer/05-publish.md)

## CI Checks

- No CI job lints skill markdown directly; run the `skill-reviewer` checklist mentally (no complex inline bash, every exit-4 handled) and keep markdownlint-friendly tables/lists (consistent table column style, MD060).

## Notes

- `enhance-issue` is not changed.
- Relative paths only. Step files resolve scripts relative to their own directory (`arcanum-create-issue/steps/`), like `enhance-issue/steps/*.md`.

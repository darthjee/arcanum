# Skill Writer Plan: Skill finish: arcanum-split-issue

Main plan: [plan.md](plan.md)

## Overview
Change `arcanum-split-issue`'s steps so every exit path (success, declined, failed) ends with exactly one report from `arcanum/_lib/finish_report.sh --skill arcanum-split-issue`, relayed verbatim, and the success path ends with a single `next_step_prompt.sh` call offering `/enhance-issue <sub-id>` for every sub-issue created in this run.

## Context
- Spec: `docs/agents/specs/skill-finish.md` (closing report format, exit paths, next-step offer protocol, next-step map row for `arcanum-split-issue`).
- Precedent to mirror: `enhance-issue/steps/publish.md` (#661) — its "Closing report" section, "Failed exits" procedure, label-change derivation from `mark-*` output, and "Next step" section.
- `arcanum-split-issue` is never run nested: no `NESTED=true`, no `--merge`, no `--nested`.
- `github.sh mark-planning` (`arcanum/_lib/github_issue_shell.sh` `cmd_mark_planning`) adds `planning` and removes `idea`/`writting`/`created`, printing `Removed tag '<tag>'` for each one actually removed. `mark-split` (called by `finish.sh`) does `planning` -> `split`.
- Decisions from issue discussion:
  - "Skip" on an already-split parent (fetch.md) is `declined`, listing existing sub-issues via `--sub-issue`, no offer.
  - Partial push failure is `failed` only when the user decides to stop recovering; if retries via `create_sub_issue.sh` succeed, continue to the normal success path.
  - On the "Continue" path, report and offer include only sub-issues created in this run.
  - On `CHOICE=yes`, run each `/enhance-issue <sub-id>` in order as a chained top-level run (own report + own offer); finish each chain before starting the next.

## Steps

- [01 — Closing report section and planning label change](skill-writer/01-closing-report-section.md)
- [02 — Fetch exits](skill-writer/02-fetch-exits.md)
- [03 — Discuss and split exits](skill-writer/03-discuss-and-split-exits.md)
- [04 — Push: success report, next-step offer, failed exit](skill-writer/04-push-success-and-failure.md)

## Notes
- Do not change `finish.sh` / `finish_shell.sh`: it keeps relabel + cleanup + safe-branch release. The report is printed after it.
- Declined/failed exits must also release the working tree via `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` before the report, as `enhance-issue` does.
- If `finish_report.sh` itself exits non-zero, tell the user in one line the report could not be rendered, and end.
- The `STATUS=error` loop in `fetch.md` (ask for a numeric id and retry) is not an exit and needs no report.

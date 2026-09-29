# Skill-writer Plan: Skill finish: plan-issue

Main plan: [plan.md](plan.md)

## Overview
Rewrite the ending of `plan-issue` (`plan-issue/steps/write_and_confirm.md`) and its early exit (`plan-issue/steps/file_definition.md`) so that the skill follows `docs/agents/specs/skill-finish.md`. The changes are:
- commit and push the confirmed plan;
- swap `Refined` → `Ready`;
- print exactly one closing report on every exit path;
- on success, offer `/auto-fix-issue <id>` via the `/dev/tty` prompt.

No new scripts are needed. Every call reuses an existing shared or cross-skill script. The pattern to mirror is `enhance-issue/steps/publish.md` (Closing report, Failed exits, Success report, Next step) together with the plan branch of `discuss-issue/steps/discuss_and_save.md` §8 (`CHOICE=yes`).

## Context
- The spec's next-step map entry for `plan-issue` is `/auto-fix-issue <id>`, delivered as an offer. Its example report reads `Plan written and committed for issue #123.` with `Labels: Refined -> Ready`.
- `plan-issue` is never run nested, so it never uses `--merge`, `--nested` or `NESTED=true`. When the user accepts the offer, `auto-fix-issue` runs as a chained top-level run.
- Existing script contracts (all already on `main`):
  - `arcanum/_lib/finish_report.sh <repo_path> --skill plan-issue --status success|declined|failed --summary "<text>" [--issue <id>] [--label-change <before>:<after>]...`: prints the report and exits 0; on a usage error it exits 1.
  - `arcanum/_lib/next_step_prompt.sh --repo <repo_path> --command "/auto-fix-issue <id>"` prints one of the following:
    - `CHOICE=yes` or `CHOICE=no` (exit 0);
    - `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3);
    - nothing (exit 1).
  - `auto-fix-all/scripts/checkout_from_main.sh <repo_path> <id>` prints `BRANCH=`, then `STATUS=ok|conflict`.
  - `auto-new-issue/scripts/commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`: commits the issue file and pushes it.
  - `auto-plan-issue/scripts/commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>`: runs `git add <plan_dir>`, commits, and pushes the current branch. `git commit` fails when there is nothing to commit.
  - `discuss-issue/scripts/github.sh mark-ready <repo_path> <id>`: swaps `Refined` for `Ready` on a best-effort basis.
  - `arcanum/_lib/checkout_safe_branch.sh <repo_path>`: releases the working tree to the safe branch.
- Decisions made with the user during `/discuss-issue`:
  - **Commit and relabel:** yes. Commit, push and swap `Refined` → `Ready` after confirmation.
  - **Declined exit:** the user explicitly abandons the "Does this approach look correct?" dialogue. Plan files stay on disk; nothing is committed and no label changes.
  - **Existing plan:** when `PLAN_EXISTS=true`, the finish is the same as for a fresh plan.

## Steps

- [01 — Closing report, failed and declined exits](skill-writer/01-closing-report-and-exits.md)
- [02 — Commit and publish the confirmed plan](skill-writer/02-commit-and-publish.md)
- [03 — Success report and next-step offer](skill-writer/03-success-report-and-next-step.md)

## Files to Change
- `plan-issue/steps/write_and_confirm.md`: add the Closing report, Failed exits, Declined exit, Commit and publish, Success report and Next step sections, and remove "Offer to open the PR".
- `plan-issue/steps/file_definition.md`: when the resolver fails, take the failed exit.
- `plan-issue/SKILL.md`: update the description and Step 3 wording to cover committing and the standard finish.

## CI Checks
- No CI job covers skill markdown directly. If any script is touched by mistake, run `yarn lint` and `yarn test` from `core/` (CircleCI jobs `checks` and `test`).

## Notes
- **`REPO_PATH`:** `plan-issue/SKILL.md` does not currently resolve `REPO_PATH`, although `file_definition.md` uses it. Add the standard line near the top of `SKILL.md`: "Resolve `REPO_PATH="$(pwd)"` now … and thread it through explicitly", matching `discuss-issue/SKILL.md`.
- **Existing plan already committed:** when `PLAN_EXISTS=true`, the plan may already be committed on `issue-<id>`, for example by `auto-plan-issue`. In that case `commit_plan.sh` fails with "nothing to commit". Before calling `commit_plan.sh`, check with `git -C "$REPO_PATH" status --porcelain -- <PLAN_DIR>` whether there is anything to commit. If nothing is pending, skip the commit, still run `git -C "$REPO_PATH" push` to cover an unpushed local commit, and continue. If this check turns out to need more than one simple command, ask `scripter` (through the architect) for a small helper rather than embedding logic.
- **Model identity:** the model name and noreply email passed to the commit scripts are "your AI model name" and "your AI model noreply email", phrased as in `discuss-issue` §8.

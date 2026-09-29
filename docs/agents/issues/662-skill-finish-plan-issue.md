# Issue: Skill finish: plan-issue

## Description
Parent: #658. Blocked by #659 (spec `docs/agents/specs/skill-finish.md`, merged); shared scripts `arcanum/_lib/finish_report.sh` and `arcanum/_lib/next_step_prompt.sh` already exist (#660).

Change `plan-issue`'s ending so it follows the standard finish defined in the spec. Once the user confirms the plan, `plan-issue` commits and pushes it and swaps `Refined` → `Ready`, matching the spec's example report. It then prints a closing report on every exit path and, on success only, offers `/auto-fix-issue <id>` via the `/dev/tty` prompt.

## Problem
`plan-issue` currently ends in `plan-issue/steps/write_and_confirm.md` with an ad-hoc chat question: "Would you like to proceed and open a PR to fix this issue now?" On yes it invokes `/auto-fix-issue <id>`. Several things are missing:
- It never commits, pushes, or relabels the plan. The spec's example report ("Plan written and committed… Labels: Refined -> Ready") assumes it does.
- It prints no closing report.
- Early exits (e.g. `resolve_plan_paths.sh` failing in `steps/file_definition.md`) stop with free-form text.
- The follow-up is chat-mediated rather than the standard `[Y]es/[N]o/[C]hat` prompt.

## Expected Behavior
**After the user confirms the plan**, on both a freshly written plan and an existing one (`PLAN_EXISTS=true`):
1. `auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>` bootstraps `issue-<id>`. `STATUS=conflict` is handled the same way as in `discuss-issue/steps/discuss_and_save.md`.
2. The issue file is committed with `auto-new-issue/scripts/commit_issue.sh` if it is not already tracked on the branch.
3. The plan is committed with `auto-plan-issue/scripts/commit_plan.sh` (never by hand).
4. `git -C "$REPO_PATH" push`.
5. `discuss-issue/scripts/github.sh mark-ready "$REPO_PATH" <id>` swaps `Refined` for `Ready`. This is best-effort; on failure the `refined:ready` label change is omitted from the report.
6. `arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"` releases the working tree.

**Closing report.** Every exit path ends with exactly one report from `arcanum/_lib/finish_report.sh "$REPO_PATH" --skill plan-issue`, relayed verbatim:
- **success**: plan confirmed, committed and pushed. Passes `--issue <id>` and `--label-change refined:ready` when mark-ready succeeded. The same finish applies whether the plan is new or existing.
- **declined**: the user explicitly abandons the "Does this approach look correct?" dialogue. Plan files are kept on disk. Nothing is committed and no labels change.
- **failed**: a script or step fails (`resolve_plan_paths.sh`, `checkout_from_main.sh`, a commit script, or the push). The summary names the failed step. The report includes only what actually happened, and the working tree is released to the safe branch.

**Next step.** On success only, the next step is offered with `arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/auto-fix-issue <id>"`:
- `CHOICE=yes`: run `/auto-fix-issue <id>` inline as a chained run (no `NESTED=true`).
- `CHOICE=no`: end.
- `CHOICE=chat` (exit 3): return to the conversation without running it.
- exit 1: say in one line that the prompt was unavailable, then end.

The ad-hoc "open a PR" chat question is removed. The skill never re-asks in chat and never changes the command that was shown.

## Solution
`skill-writer` updates two files:
- `plan-issue/steps/write_and_confirm.md`: replace "Offer to open the PR" with sections for committing and publishing the plan, the closing report, failed exits, the success report and the next step. Mirror `enhance-issue/steps/publish.md` and `discuss-issue/steps/discuss_and_save.md` §8, reusing their cross-skill scripts rather than duplicating logic.
- `plan-issue/steps/file_definition.md`: add a failed exit when the resolver fails.

`plan-issue` is never run nested, so `--merge` and `NESTED` are not used.

Note for planning: the plan (and possibly the issue file) is written to the working tree before `checkout_from_main.sh` runs. The steps must make sure those files carry over onto `issue-<id>` cleanly, as `discuss-issue` already does for its issue file.

## Benefits
- A consistent, scriptable ending across the interactive issue skills.
- Plans made with `plan-issue` become `Ready` for `auto-fix-issue` / `auto-fix-all` without manual steps.
- The next command is always shown, so it can be run by hand later.

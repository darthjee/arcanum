# Closing report, NESTED, and failed exits in run.md

Mirror the structure `auto-plan-issue/steps/run.md` got in #665:

1. **NESTED paragraph** right after the `REPO_PATH` paragraph at the top: the invocation may carry `NESTED=true` (set by `auto-fix-all`). If it is absent, this is a top-level run. When present, pass it on to any run this skill nests in turn (currently none), and change every exit per [Closing report](#closing-report).
2. **Step 0 (resume)**: the `pr_published` row currently says "(already done — report and exit)". Change it to end with the `success` report: `--issue <id> --pr <pr_id>` (from `scripts/issue_state.sh "$REPO_PATH" get <id> pr_id`), no `--label-change`, `--next "/auto-fix-issue ..."` → `--next "/auto-monitor-issue-pr <id>"`, and a summary such as "PR for #<id> already published; nothing to do."
3. **Wire every early exit to "fail with `<step>`"**, with `--issue <id>` only when an id was parsed:
   - Step 1: no numeric id / `resolve_plan_paths.sh` non-zero → `resolve_plan_paths.sh`; `PLAN_EXISTS=false` → `locate plan`, with a summary saying no plan exists (e.g. "run /auto-plan-issue <id> first"). Only as summary text: `failed` never carries `--next`.
   - Step 2: `create_branch.sh` non-zero → `create_branch.sh`; `merge_main.sh` non-zero or a conflict that cannot be resolved → `merge_main.sh`.
   - Step 3: `list_plan_agents.sh` non-zero → `list_plan_agents.sh`.
   - Step 4/5: a specialist dispatch that is blocked, or work still incorrect after re-dispatch → `dispatch agents` / `review`, naming the agent in the summary.
   - Step 6: any failure inside [open_pr.md](open_pr.md) → `open PR` (see step 02).
4. **Step 6 closing line**: replace "Report the final PR URL." with a pointer to the success report defined in `open_pr.md`'s "Report" section.
5. **New `## Closing report` section** at the end, with the same three parts as `auto-plan-issue`:
   - Generic call shape: `../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status success|failed --summary "<one line>" [--issue <id>] [--pr <n>] [--label-change :pr] [--next "/auto-monitor-issue-pr <id>"] [--nested]`, and a note: never asks the user anything, so there is no `declined` status. Relay stdout verbatim as the last output. Pass only what actually happened. `failed` never carries `--next`. If the script itself exits non-zero, say so in one line and end.
   - `### Nested runs`: with `NESTED=true`, use the same flags **minus `--next`**, **plus `--nested`**, and end by relaying the `FINISH_*` block verbatim to the caller.
   - `### Failed exits`: stop at once, leave commits/branch as they are, don't retry, and print the `failed` report with the summary `"<step> failed: <short reason>."`.

## Files to Change
- `auto-fix-issue/steps/run.md` — NESTED paragraph, resume success report, fail-with wiring in Steps 1–6, `## Closing report` section.

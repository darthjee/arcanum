# Success report in open_pr.md and SKILL.md relay wording

**`auto-fix-issue/steps/open_pr.md`**:
- "Exit code 1, with an error message on stderr" (`pr-view`), and a non-zero `pr-ready` / `pr-create`: replace "Report it; do not silently continue" with **fail with** `open PR` (see `run.md`'s Failed exits), with `--issue <id>`.
- Track which path ran: `pr-create`, `pr-ready`, or already open and ready.
- Replace the `## Report` section with the success report:

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status success --issue <id> --pr <pr_id> \
    [--label-change :pr] --summary "<one line>" --next "/auto-monitor-issue-pr <id>"
  ```

  - `<pr_id>` comes from `scripts/issue_state.sh "$REPO_PATH" get <id> pr_id` (set by `pr-create`/`pr-view`).
  - Pass `--label-change :pr` only when `pr-create` or `pr-ready` ran in this run.
  - Summary by path, e.g. "PR opened for #<id>.", "Draft PR marked ready for #<id>.", "PR for #<id> was already open and ready."
  - With `NESTED=true`, drop `--next`, add `--nested`, and relay the `FINISH_*` block (link to `run.md`'s Nested runs).
- The "Report" wording must not ask for confirmation. Keep the "no confirmation" sentence.

**`auto-fix-issue/SKILL.md`**: change "relay its final report (including the PR URL) to the user verbatim" to "relay its closing report (the `finish_report.sh` block) to the user verbatim — do not summarize or reinterpret it." A top-level `/auto-fix-issue` is never nested, so the spawn prompt passes no `NESTED=true`.

## Files to Change
- `auto-fix-issue/steps/open_pr.md` — fail-with wiring for `gh` errors, success report replaces "Report the final PR URL".
- `auto-fix-issue/SKILL.md` — relay wording.

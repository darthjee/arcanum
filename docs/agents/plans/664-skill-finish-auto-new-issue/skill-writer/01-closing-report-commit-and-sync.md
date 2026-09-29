# Closing report in commit_and_sync.md

Replace the final paragraph of `auto-new-issue/steps/commit_and_sync.md` ("This is the final step of the skill … No further confirmation or output is required.") with a `## Closing report` section, modelled on `plan-issue/steps/write_and_confirm.md`:

- Show the `finish_report.sh` call shape with `--skill auto-new-issue`, and state the rules:
  - relay stdout verbatim as the last output, never hand-format it;
  - pass only links that actually happened;
  - if the script itself exits non-zero, say in one line that the report could not be rendered, and end.
- **Success**: after "Sync to GitHub" returns, or is skipped because the issue was just minted, call it with `--status success --issue <ID> --next "/auto-plan-issue <ID>"`.
- **Failed exits**: add a "fail with `<step>`" convention. Mark `github.sh create`, `commit_issue.sh` and `github.sh update` as failure points: stop, and report `--status failed`, with the summary naming the step and `--issue <ID>` only when an id is known. For a `create` failure no id exists yet, so omit `--issue`. No `--next`.
- **Nested**: when the invocation carried `NESTED=true`, make the same call minus `--next`, plus `--nested`, and end by relaying the `FINISH_*` block to the caller instead of a report. This applies to every call in this file and in `run.md`.

## Files to Change
- `auto-new-issue/steps/commit_and_sync.md` — new closing-report section, failure points and nested rule.

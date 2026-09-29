# Add NESTED and closing-report rules to run.md
In `auto-plan-issue/steps/run.md`:

1. In the intro (after the `REPO_PATH` paragraph), add a paragraph mirroring `auto-new-issue/steps/run.md`: the invocation prompt may carry `NESTED=true`, set by a nested caller such as `auto-fix-all` or `discuss-issue`; its absence means top level; when present, pass it on to any run this skill nests (currently none); it changes how every exit ends — see the closing-report section.
2. Add a `## Closing report` section (at the end of the file, replacing nothing yet) with three sub-sections mirroring `auto-new-issue/steps/commit_and_sync.md`:
   - general rule: every exit path ends by relaying `finish_report.sh`'s stdout verbatim, as the last thing printed; pass only what actually happened; `failed` never carries `--next`; no `--label-change` (this skill changes no labels); if the script itself exits non-zero, say so in one line and end.
   - `### Nested runs`: with `NESTED=true`, every `finish_report.sh` call in this file uses the same flags minus `--next`, plus `--nested`, and the run ends by relaying the `FINISH_*` block verbatim to its caller, with no report and no `Next:` line.
   - `### Failed exits`: "**fail with** `<step>`" means stop right there, leave anything already written on disk, do not retry, and print:

     ```bash
     ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-plan-issue --status failed [--issue <id>] \
       --summary "<step> failed: <short reason>."
     ```

     `--issue <id>` only when the id was parsed.

## Files to Change
- `auto-plan-issue/steps/run.md` — `NESTED=true` intro paragraph; new `## Closing report` section.

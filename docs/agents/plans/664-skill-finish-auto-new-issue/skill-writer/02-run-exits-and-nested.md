# Route run.md exits to the report and accept NESTED

In `auto-new-issue/steps/run.md`:

- In the intro paragraph, note that the invocation prompt may also carry `NESTED=true`, set by a nested caller such as `auto-fix-all`. Its absence means top level. It must be passed on to any run this skill nests in turn (currently none). Point to the closing-report section in `commit_and_sync.md` for how it changes the ending.
- **`STATUS=existing`**: replace "Skip straight to confirming nothing else needs to be done" with this: end with the closing report, `--status success --issue <ID> --next "/auto-plan-issue <ID>"` (minus `--next`, plus `--nested` when nested). The summary says the issue file already existed and nothing was written.
- **`resolve_id_and_file.sh` failure**: fail with `resolve_id_and_file.sh` per the failed-exit convention, with no `--issue` unless one was parsed from the arguments.
- Step 2's fetch failure stays non-fatal. Make that explicit, so it is not read as a failed exit.

## Files to Change
- `auto-new-issue/steps/run.md` — NESTED intake, existing-file and resolve-failure exits routed to the closing report.

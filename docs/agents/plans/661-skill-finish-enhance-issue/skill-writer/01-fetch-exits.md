# Record the enhancing change and fail on fetch errors

In `enhance-issue/steps/fetch.md`:

1. **Failed exit on `resolve_and_fetch.sh` script error** (e.g. dirty working tree; not the `STATUS=error` re-ask case): print
   `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status failed --summary "resolve_and_fetch.sh failed: <short reason>." [--issue <id>]`
   (`--issue` only if the args already held a numeric id), relay verbatim, end. No label change, no offer. Mirror `discuss-issue/steps/extract_id_and_name.md`.
2. **Derive the enhancing change** from `mark-enhancing`'s output, and carry it through the rest of the run:
   - `idea:enhancing` if it printed `Removed tag 'idea'`;
   - `writting:enhancing` if it printed `Removed tag 'writting'`;
   - `:enhancing` if it only added `enhancing`;
   - none if `Enhancing` was already present (resumed run) or the call failed. `mark-enhancing` stays best-effort and is never a failure.

   If the `mark-enhancing` output format needs checking, read `arcanum/_lib/github_issue_mark_enhancing_shell.sh` and `arcanum/_lib/tag_mutate.sh`.

## Files to Change
- `enhance-issue/steps/fetch.md`: failed-exit report, and the enhancing-change derivation rules.

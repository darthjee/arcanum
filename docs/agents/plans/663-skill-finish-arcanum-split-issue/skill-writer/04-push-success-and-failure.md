# Push: success report, next-step offer, failed exit

In `steps/push.md`:

- **STATUS=ok**: after `finish.sh`, replace the free-text "split is complete" listing with the `success` report: `--issue <id>`, one `--sub-issue <new_id>` per `CREATED` pair from this run (plus any recovered via `create_sub_issue.sh`), `--label-change <planning change>` (if any) and `--label-change planning:split`. Summary e.g. `Issue #<id> split into <N> sub-issues.`
- Then the next-step offer, once: `../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/enhance-issue <sub-id>"` repeated per new sub-issue, in creation order. Handle the result as in `enhance-issue/steps/publish.md`:
  - `CHOICE=yes`: run each `/enhance-issue <sub-id>` inline, in listed order, as a chained top-level run (no `NESTED=true`); each prints its own report and offer, and its whole chain completes before the next sub-issue starts.
  - `CHOICE=no`: end. `CHOICE=chat` (exit 3): return to conversation. Exit 1: say in one line the prompt was unavailable, end. Never re-ask in chat or change the commands.
- **STATUS=failed**: keep the current recovery flow (report CREATED/FAILED, advise checking GitHub, retry single files with `create_sub_issue.sh`, never re-run `push_sub_issues.sh`). If recovery completes, continue to the success path above. If the user decides to stop, **fail with** `Push sub-issues`: `--sub-issue` for every sub-issue created so far, the planning change, parent stays `Planning`.

## Files to Change
- `arcanum-split-issue/steps/push.md` — success report + next-step offer; failed report on abandoned recovery.

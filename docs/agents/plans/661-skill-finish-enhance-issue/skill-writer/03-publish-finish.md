# Standard finish in publish

Restructure `enhance-issue/steps/publish.md`:

1. **Closing report** section (shared rules for every exit, referenced from fetch.md and dialogue.md): the `finish_report.sh` signature with `--skill enhance-issue`, relay verbatim, pass only what happened, and no offer after `declined`/`failed`. If the script exits non-zero, say in one line that the report couldn't be rendered, and end.
2. **Failed exits**: release the tree, keep the draft, print a `failed` report whose summary names the step, with `--label-change <enhancing change>` if one was recorded, then end.
3. **Update**: if `github.sh update` exits non-zero, **fail with** `Publish (update)`. `mark-created` stays best-effort. Derive the **created change**:
   - `enhancing:created` if it printed `Removed tag 'enhancing'`;
   - else `idea:created` / `writting:created` if it printed `Removed tag 'idea'` / `Removed tag 'writting'` (e.g. `mark-enhancing` had failed earlier);
   - else `:created`.
4. Delete the draft and release the tree (unchanged).
5. Replace the §4 ad-hoc confirmation with the success report:
   `finish_report.sh "$REPO_PATH" --skill enhance-issue --status success --issue <id> --summary "Issue #<id> enhanced and pushed to GitHub." [--label-change <enhancing change>] --label-change <created change>`, plus `--sub-issue <id>` for any issue spawned with `--as-subissue` during the dialogue.
6. **Next step**: `../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "/discuss-issue <id>"`:
   - `CHOICE=yes`: invoke `/discuss-issue <id>` inline as a chained top-level run (no `NESTED=true`).
   - `CHOICE=no`: end.
   - `CHOICE=chat` (exit 3): return to the conversation, and don't run it unless asked.
   - exit 1: one line saying the prompt was unavailable, then end.

   Never re-ask in chat and never change the shown command.

Also update the "Step 4" line in `enhance-issue/SKILL.md` if its wording implies the old ending (e.g. mention it ends with the closing report and next-step offer).

## Files to Change
- `enhance-issue/steps/publish.md`: closing report, failed exits, created-change derivation, success report, and next-step offer.
- `enhance-issue/SKILL.md`: Step 4 wording only, if needed.

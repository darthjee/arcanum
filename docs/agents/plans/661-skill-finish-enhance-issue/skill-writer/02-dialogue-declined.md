# Add the declined exit to the dialogue

In `enhance-issue/steps/dialogue.md`, add an "Abandoning the enhancement (declined)" subsection. If at any point in the loop the user explicitly abandons it ("stop", "drop it", "leave it as is"):

1. Do not push anything and do not change any further label. `Enhancing` stays (no revert).
2. Keep the local draft `FILE`, so a later `/enhance-issue <id>` resumes from it.
3. Release the tree: `../../arcanum/_lib/checkout_safe_branch.sh "$REPO_PATH"`.
4. Print and relay verbatim:
   `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill enhance-issue --status declined --issue <id> --summary "Enhancement of issue #<id> abandoned by the user; nothing was pushed." [--label-change <enhancing change>]`
5. End. No next-step offer.

Make clear that a user merely not being satisfied with one topic is not a decline. Only an explicit abandonment is.

## Files to Change
- `enhance-issue/steps/dialogue.md`: new declined subsection, linking to publish.md's "Closing report" rules.

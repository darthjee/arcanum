# Issue: Add reaction on PR comment

## Description
Right now, monitoring a PR fetches comments but gives the user no feedback on whether/when a comment has been addressed. Comments should be tracked, marked with reactions as they move from open to addressed, and linked from the commits that address them.

## Problem
- The PR-monitoring script fetches comments but does not signal which ones are being worked on or have been resolved.
- There is no persistent record of comment status (open vs addressed).
- Commit messages don't reference which comment (if any) they address.

## Expected Behavior
- When the PR-monitoring script finds comments that need to be addressed, it should record them (ID, user, status) before handing off to the agents.
- Comments being addressed should receive a 👀 (`:eyes:`) reaction to signal they're being worked on.
- Once an agent pushes a new commit addressing a comment, the script should swap the reaction to ✔️ (`:heavy_check_mark:`) and mark the comment as addressed in the stored record.
- Commit messages should include a link to the comment they address, when applicable. Commits unrelated to a specific comment (e.g. initial commits) should still use a valid template without a comment link.

## Solution
- **Script changes** (PR-monitoring script):
  - Update the issue JSON with a `comments` array of objects containing `ID`, `user`, and `status` (`open` initially, `addressed` later). Add other fields as needed.
  - Add a 👀 reaction to all comments that will be addressed.
  - When agents push the branch again (script is called to re-push):
    - Re-read the comments from the JSON.
    - For comments now addressed, remove the 👀 reaction and add a ✔️ reaction.
    - Update the JSON to mark those comments as `addressed`.
- **Skill changes** (`auto-fix-issue`):
  - When agents commit, if the commit addresses a comment, pass the comment ID to the script so it can be recorded/reacted to.
  - Update (or create) the commit message template to include a link to the addressed comment.
  - The template must also support commits with no associated comment (e.g. initial commits).
  - Update (or create) the `init-claude` commit message template to also support a comment link.
  - Consider splitting the skill into a variant for initial commits and a variant for addressing comments, if that simplifies the templates.

## Benefits
- Users get visible, real-time feedback (via emoji reactions) on which PR comments are being worked on and which have been resolved.
- Commit history becomes traceable back to the specific review comment it addresses, improving auditability.

---
See issue for details: https://github.com/darthjee/arcanum/issues/21

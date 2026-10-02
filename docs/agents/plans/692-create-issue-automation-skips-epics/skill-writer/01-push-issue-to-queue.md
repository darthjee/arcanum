# `/push-issue-to-queue` refuses Epics

In Step 1 of `push-issue-to-queue/SKILL.md`, after parsing the ids, run `../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic` for each id. On exit `0`, print `#<id> is an Epic — split it with /arcanum-split-issue` and leave that id out. Then run **one** `../auto-fix-all/scripts/queue.sh push "$REPO_PATH" <remaining ids…>`, and skip it when no ids are left. Step 2 reports the refusal lines and then the push output verbatim. No new script. `queue.sh push` stays GitHub-free. Update the skill `description` front matter to mention that Epics are refused.

## Files to Change
- `push-issue-to-queue/SKILL.md` — per-id Epic check, single push of the remaining ids, report.

# `auto-fix-all` skips a queued Epic

The queue is peeked (`queue.sh wait-next`) and popped only after an outcome, so the "after pop" check from the spec belongs right after `wait-next` in `auto-fix-all/SKILL.md` Step 2, before the `architect` agent is spawned. Run `scripts/github.sh has-label "$REPO_PATH" <id> Epic`. On exit `0`: print `Skipped #<id>: Epic (split it with /arcanum-split-issue)`, run `scripts/queue.sh pop "$REPO_PATH"`, and apply the same `queue.sh empty && config.sh is-enabled finish_on_empty_queue` check as the `merged` branch: if both are true, go to Step 4; otherwise go back to Step 2. There is no user interaction, no label change and no `clear_context` wakeup. Mention the skip in the Step 4 summary. Because the check runs before every spawn, re-invocations (`clear_context`, `pending`) also re-check the front id, which is intended. `process_one_issue.md` keeps calling `has-shipit-label` (alias), unchanged.

## Files to Change
- `auto-fix-all/SKILL.md` — Epic check after `wait-next`, skip/pop/continue, summary line.

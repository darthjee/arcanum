# Turn auto-fix-all into a queue wrapper

Update `auto-fix-all/SKILL.md` so its per-issue spawn points at the moved step:

- Step 2 spawn prompt: "Read steps/process_one_issue.md (resolved relative to the `auto-resolve-issue` skill folder) …". The rest of the prompt and the `OUTCOME=` list are unchanged.
- Add one sentence near the top: the per-issue pipeline lives in `auto-resolve-issue`, and `auto-fix-all` is the queue wrapper around it. `/auto-resolve-issue <id>` runs the same pipeline for a single issue without the queue.
- The other mentions of `process_one_issue.md` (closed → reimplement, blocked → retry, pending) stay valid by file name. Make the first mention link to `../auto-resolve-issue/steps/process_one_issue.md` so the location is unambiguous.
- No behavioral change: queue, Epic skip, `clear_context`, `finish_on_empty_queue`, closed/blocked questions, and pending `ScheduleWakeup` all stay as they are.
- Confirm `auto-fix-all/steps/` is empty after step 01 and remove the folder (git does not track empty folders).

## Files to Change
- `auto-fix-all/SKILL.md` — spawn prompt and references point at `auto-resolve-issue/steps/process_one_issue.md`; note that it wraps `auto-resolve-issue`

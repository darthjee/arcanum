# auto-fix-all: hand off instead of the clearing wakeup

In `auto-fix-all/SKILL.md`, Step 3, `OUTCOME=merged`, rewrite the "Check whether to
clear context" block's **Exit 0 (`true`)** bullet:

1. If `mcp__arcanum-next-step__handoff` is in the tool list, call it with
   `{ command: "/loop /auto-fix-all" }`. On a success result, end the turn with
   no further output. The mod runs `/clear`, then the command, and the fresh
   iteration re-reads the queue (Step 1's "no arguments" branch).
   - Error `a handoff is already pending: ...`: end the turn (no fallback, so the
     command doesn't fire twice).
2. Any other error result, or the tool is missing: print one line,
   `clear skipped: <reason>`, then call `ScheduleWakeup(delaySeconds=60,
   prompt="/auto-fix-all", reason="restarting before next issue")` and stop, as
   today. Say plainly that this restart keeps the conversation context.

Link to [Clearing](../docs/agents/architecture/skill-finish.md#clearing) for the
shared contract. Keep the "requires `/loop /auto-fix-all <ids>`" note, since the
fallback and the `pending` wakeup depend on it.

Also update the references that call the wakeup "the `clear_context` wakeup":

- line ~52 ("do not schedule a `clear_context` wakeup") → "do not hand off or
  schedule a `clear_context` restart".
- line ~55 ("re-invocations (`clear_context`, `pending`)"), which stays accurate.
  Adjust the wording only if needed.
- line ~123 (`OUTCOME=pending`) "same as the existing `clear_context` wakeup" →
  refer to the `/loop` requirement without implying the clear uses a wakeup.

Leave `OUTCOME=pending`'s own 300-second wakeup unchanged.

## Files to Change

- `auto-fix-all/SKILL.md` — Step 3 `clear_context` branch, plus the wording in
  Step 2 and `OUTCOME=pending` described above.

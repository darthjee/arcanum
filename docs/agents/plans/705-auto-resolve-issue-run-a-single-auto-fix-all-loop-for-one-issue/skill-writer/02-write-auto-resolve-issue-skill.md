# Write auto-resolve-issue/SKILL.md

Create the single-issue coordinator, modelled on `auto-fix-all/SKILL.md` Steps 0, 2, 3 and 4 without the queue.

Frontmatter:
- `name: auto-resolve-issue`
- `description`: autonomously takes one issue through the full pipeline (new issue → plan → fix → PR → monitor → merge), rescheduling itself via `ScheduleWakeup` while the PR is pending (run via `/loop`). It asks the user only when the PR is closed without merging or a specialist dispatch is blocked. Usage: `/auto-resolve-issue <id>` or `/auto-resolve-issue #<id>`.

Body. You are the coordinator; per-issue work is delegated to a spawned `architect`.

1. **Resolve REPO_PATH** with `REPO_PATH="$(pwd)"`, fresh on every invocation (including each `ScheduleWakeup` re-entry), and thread it through every script call and into the spawn.
2. **Parse the id** from the arguments (accept `99` or `#99`). If there is none, end with a `failed` report.
3. **Epic check**: `../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic` (resolved relative to the `auto-fix-all` skill folder).
   - Exit 0: end with a `declined` report, summary `Issue #<id> is an Epic; split it with /arcanum-split-issue <id>.` Ask nothing.
   - Any non-zero exit: treat as not an Epic.
4. **Spawn** `Agent(subagent_type: "architect", prompt: "Read steps/process_one_issue.md (resolved relative to the `auto-resolve-issue` skill folder) and follow it for issue `<id>`. REPO_PATH: `<resolved_path>`. Report OUTCOME=merged, OUTCOME=closed PR_NUMBER=`<n>`, OUTCOME=blocked AGENT=`<agent-name>` ACTION=`<description>`, or OUTCOME=pending PR_NUMBER=`<n>`.")`, then parse `OUTCOME`.
5. **React**:
   - `merged`: end with a `success` report carrying `--issue <id> --pr <n>` (resolve `<n>` with `../auto-fix-all/scripts/github.sh pr-number "$REPO_PATH"` if not at hand) and summary `Issue #<id> resolved; PR merged.` No next-step offer.
   - `pending`: `ScheduleWakeup(delaySeconds=300, prompt="/auto-resolve-issue <id>", reason="waiting for PR #<n> to reach a terminal state")` and stop. This requires `/loop /auto-resolve-issue <id>`; when that isn't the case, say so plainly instead of silently doing nothing. Each wakeup re-enters from step 1, and the idempotent guards in `process_one_issue.md` fast-forward to one more monitor check.
   - `closed`: ask with `AskUserQuestion` whether to reimplement from scratch or stop.
     - Reimplement: run `../auto-fix-all/scripts/github.sh cleanup-branch "$REPO_PATH" <id>`, then go back to step 4.
     - Stop: end with a `declined` report carrying `--pr <n>`, summary `PR #<n> for issue #<id> was closed without merging; stopped.`
   - `blocked`: ask with `AskUserQuestion` whether to retry (e.g. after granting the permission out-of-band) or stop.
     - Retry: go back to step 4.
     - Stop: end with a `declined` report, summary naming the blocked agent and action.

     Deliberately no "do it yourself" option (same rationale as `auto-fix-all`).
6. **Closing report**: every exit goes through `../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-resolve-issue --status success|declined|failed --summary "<one line>" [--issue <id>] [--pr <n>]`, relayed verbatim. Follow `docs/agents/architecture/skill-finish.md`. No `--next` on any path. The `pending` reschedule is not an exit and prints no report.

There is no `clear_context` handling, since only one issue is processed.

## Files to Change
- `auto-resolve-issue/SKILL.md` — new single-issue coordinator skill

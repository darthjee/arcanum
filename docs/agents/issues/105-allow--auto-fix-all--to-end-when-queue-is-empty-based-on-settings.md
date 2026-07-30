# Issue: Allow `auto-fix-all` to end when queue is empty based on settings

## Description
`auto-fix-all` maintains a queue of issue ids (`.claude/state/auto-fix-all-queue.json`) via `auto-fix-all/scripts/queue.sh`. When the queue empties, the orchestrator calls `queue.sh wait-next`, which sleeps and retries forever until a new id is pushed (e.g. via `/push-issue-to-queue`), so the skill is designed to run as a long-lived worker.

Separately, `auto-fix-all/scripts/config.sh` already supports a personal, gitignored setting, `clear_context` (stored in `.claude/state/auto-fix-all-config.json`, not committed), which controls whether context is cleared between issues via `ScheduleWakeup` (only takes effect when invoked through `/loop /auto-fix-all <ids>`).

## Problem
When a user runs `/auto-fix-all` for just one or a few issues to check the result, the orchestrator still blocks forever on `queue.sh wait-next` once the queue drains, leaving an agent waiting indefinitely instead of ending the run.

## Expected Behavior
A new personal, gitignored setting, `finish_on_empty_queue` (stored alongside `clear_context` in `.claude/state/auto-fix-all-config.json`), lets the user opt into ending the run instead of waiting when the queue empties.

`finish_on_empty_queue` and `clear_context` interact as follows:

| `finish_on_empty_queue` | `clear_context` | queue empty? | finish? | clear_context applied? |
| --- | --- | --- | --- | --- |
| false | false | false | no | no |
| false | false | true | no | no |
| false | true | false | no | yes |
| false | true | true | no | yes |
| true | false | false | no | no |
| true | false | true | yes | no |
| true | true | false | no | yes |
| true | true | true | yes | no |

In words: the run finishes only when `finish_on_empty_queue` is on and the queue is empty — in that case context is *not* cleared first (so the user can still inspect/reuse the last context), overriding whatever `clear_context` would otherwise do. In every other case, `clear_context` behaves exactly as it does today, independent of `finish_on_empty_queue`.

## Solution
### Add `finish_on_empty_queue` to the personal config
Add `finish_on_empty_queue` (`true`/`false`) to `.claude/state/auto-fix-all-config.json`, following the same pattern already used for `clear_context` in `auto-fix-all/scripts/config.sh`. Default (absent) is `false`, preserving today's behavior.

`auto-fix-all/scripts/queue.sh wait-next` and the orchestrator (`auto-fix-all/SKILL.md` Step 2/3) need to consult this flag when the queue is empty and stop the run cleanly — with no agent left blocked waiting on the queue — instead of sleeping/retrying forever, per the table above.

### Surface both flags in `init-claude`
Add a new step to `init-claude` (after the existing `setup_labels.md` step) that asks the user whether they want to configure `auto-fix-all`'s personal run behavior, explains what `finish_on_empty_queue` and `clear_context` each do, and — if the user opts in — writes both into `.claude/state/auto-fix-all-config.json` (not committed), mirroring how `setup_ci_monitoring.md` optionally writes `.claude/configuration/auto-fix-all.json` today.

This `init-claude` step is the only configuration entry point for `finish_on_empty_queue` — no standalone `/toggle-finish-on-empty-queue` skill for now (unlike `clear_context`, which also has `/toggle-clear-context`).

### Reporting when the run finishes this way
When the run stops because the queue emptied with `finish_on_empty_queue` on, `auto-fix-all/SKILL.md`'s Step 4 reports the same summary it already produces for an externally-interrupted run (final PR URL + outcome per processed id) — no separate message distinguishing this case.

## Benefits
- A single-issue (or small-batch) `/auto-fix-all` run can be checked and left to finish cleanly, without an orchestrator agent stuck waiting on an empty queue.
- Preserves today's "loop forever" default for unattended/continuous use — this is strictly opt-in.
- Keeps the two personal-preference flags discoverable together during project setup (`init-claude`), instead of only via ad hoc toggling.

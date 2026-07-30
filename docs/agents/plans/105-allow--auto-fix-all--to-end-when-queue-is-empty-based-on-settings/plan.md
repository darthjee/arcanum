# Plan: Allow `auto-fix-all` to end when queue is empty based on settings

Issue: [105-allow--auto-fix-all--to-end-when-queue-is-empty-based-on-settings.md](../../issues/105-allow--auto-fix-all--to-end-when-queue-is-empty-based-on-settings.md)

## Overview

Add a new personal, gitignored `finish_on_empty_queue` flag so a user can opt an `/auto-fix-all` run into stopping cleanly once its queue drains, instead of blocking forever on `queue.sh wait-next`. The flag is read the same way `clear_context` already is (via `auto-fix-all/scripts/config.sh`), interacts with `clear_context` per the truth table in the issue, and is surfaced through a new `init-claude` setup step.

## Context

- `auto-fix-all/scripts/config.sh` already splits config keys between a committed file (`.claude/configuration/auto-fix-all.json`) and a personal gitignored file (`.claude/state/auto-fix-all-config.json`), routing by key name in `_config_file_for_key`. Today only `clear_context` is routed to the personal file.
- `auto-fix-all/scripts/queue.sh` already exposes an `empty` command (exit 0 if the queue is empty, exit 1 otherwise) — no change needed there.
- `auto-fix-all/SKILL.md` Step 3 (`OUTCOME=merged` branch) pops the finished issue, then unconditionally checks `clear_context` to decide between `ScheduleWakeup` (stop this instance, rely on the wakeup to re-enter Step 2) and looping back to Step 2 directly.
- The issue's truth table requires that when the run is about to finish (`finish_on_empty_queue` on AND queue empty), `clear_context` must NOT be applied — no context-clearing wakeup should happen first. This means the finish check must run *before* the existing `clear_context` check in Step 3, not inside `queue.sh wait-next` (Step 2's call site is the only caller of `wait-next`, and by the time Step 3 decides not to finish, `wait-next`'s original forever-blocking behavior is already correct for every remaining case — see Notes).
- `init-claude/setup_ci_monitoring.md` is the existing precedent for an optional, ask-then-write `init-claude` step that writes into `auto-fix-all`'s config; the new step follows the same shape but targets the personal state file and both flags.

## Implementation Steps

### Step 1 — Route `finish_on_empty_queue` to the personal config file

In `auto-fix-all/scripts/config.sh`, extend `_config_file_for_key` to route both personal, frequently-toggled keys to `STATE_CONFIG_FILE`:

```bash
_config_file_for_key() {
  case "$1" in
    clear_context|finish_on_empty_queue) echo "$STATE_CONFIG_FILE" ;;
    *) echo "$CONFIG_FILE" ;;
  esac
}
```

Update the comment above the function (currently describes only `clear_context`) to mention both keys. No other part of `config.sh` needs to change — `get`, `is-enabled`, `set`, and `toggle` all already work generically by key.

### Step 2 — Finish check in `auto-fix-all/SKILL.md` Step 3

In the `OUTCOME=merged` branch, right after `scripts/queue.sh pop` and before the existing `clear_context` check, add a finish check:

```bash
scripts/queue.sh empty && scripts/config.sh is-enabled finish_on_empty_queue
```

- **Both true (exit 0)**: skip the `clear_context` check entirely — no `ScheduleWakeup`, no looping back to Step 2. Go straight to Step 4 and report the summary (same summary Step 4 already produces for an externally-interrupted run).
- **Otherwise**: fall through to the existing `clear_context` check, unchanged.

### Step 3 — Update Step 2's description of `wait-next`

Step 2's comment currently says `wait-next` "sleeps 5 seconds and checks again, forever". This is still accurate and requires no code change (see Notes), but reword slightly to clarify that a queue emptying with `finish_on_empty_queue` on is intercepted one step earlier, in Step 3, before `wait-next` would ever be called on a should-finish queue.

### Step 4 — New `init-claude` step for both flags

Add `init-claude/setup_auto_fix_all_config.md`, following the shape of `init-claude/setup_ci_monitoring.md`:

1. Ask the user:
   ```
   Would you like to configure how /auto-fix-all behaves between issues in this project (clear_context, finish_on_empty_queue)? [y/n]
   ```
2. If yes, explain each flag in plain language and ask for each independently:
   - `clear_context` — clear conversation context between issues (via a short `ScheduleWakeup` pause); only takes effect when `auto-fix-all` is invoked through `/loop`.
   - `finish_on_empty_queue` — stop the run once the queue empties instead of waiting forever for more issues to be pushed onto it.
3. For each flag the user gives an answer for, run:
   ```bash
   ../auto-fix-all/scripts/config.sh set clear_context true|false
   ../auto-fix-all/scripts/config.sh set finish_on_empty_queue true|false
   ```
   (both routed to `.claude/state/auto-fix-all-config.json` by Step 1's change; not committed).
4. If the user says no to the initial question, skip silently — do not write anything.

Wire it into `init-claude/SKILL.md` as a new **Step 11**, after the existing Step 10 (`setup_labels.md`).

No standalone `/toggle-finish-on-empty-queue` skill is being added (per the issue) — this `init-claude` step is the only configuration entry point for the new flag, alongside the pre-existing `/toggle-clear-context`.

## Files to Change

- `auto-fix-all/scripts/config.sh` — route `finish_on_empty_queue` to the personal state file alongside `clear_context`.
- `auto-fix-all/SKILL.md` — add the pre-`clear_context` finish check in Step 3; reword Step 2's `wait-next` description.
- `init-claude/setup_auto_fix_all_config.md` — new file, ask-and-write step for both flags.
- `init-claude/SKILL.md` — add new Step 11 referencing the file above.

## Notes

- `auto-fix-all/scripts/queue.sh` needs no code change. Its only caller, Step 2 of `auto-fix-all/SKILL.md`, only reaches `wait-next` after Step 3 has already decided *not* to finish — meaning every remaining case genuinely wants `wait-next`'s original forever-blocking behavior, flag or no flag. Placing the check in Step 3 (immediately after `pop`, before `clear_context`) is also the only way to guarantee the issue's truth table exactly, since deferring the check into `wait-next` would let one pointless clear-context-and-wakeup round-trip happen before the run finishes.
- Default (absent) `finish_on_empty_queue` is `false`, preserving today's forever-looping behavior for existing projects that don't set it.
- No CI config exists in this repo (no `.github/workflows`, no `.circleci`), so no `## CI Checks` section applies.

# Architect Plan: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

Main plan: [plan.md](plan.md)

## Shared contracts

The `run.sh` exit-`4` contract and the skill mapping in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Update the per-repo migrations doc
In `docs/agents/architecture/per-repo-migrations.md`:
- In the runner-chain paragraph, replace "and `run.sh` adopts the exit-`4` `AskUserQuestion` fallback below in #682" with a present-tense statement: `run.sh`'s interactive form exits `4` with `FALLBACK=chat` + `CURRENT=/LOCAL=/GLOBAL=/PENDING=` when no TTY is available, and `/arcanum-migrate` asks via `AskUserQuestion` and resumes through `apply`.
- Document the fallback granularity: per version only; the per-version and per-entry prompts of the sub-scripts are not reproduced (they keep their exit-`1` no-TTY error, reached only through `apply --no-confirm` in fallback mode).
- In the `#script-driven-interaction` paragraph, change "adopts the fallback in #682" to say it implements it (reference for the multi-level case).

## Files to Change
- `docs/agents/architecture/per-repo-migrations.md` — present-tense fallback description, granularity note.

## Notes
- `AGENTS.md` and `skill-finish.md` already describe the convention generically (#681); no change needed there.

# Skill-writer Plan: Add next_step.clear.* keys and CLEAR=true script protocol

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on `init-claude/scripts/set_next_step_clear.sh <repo_path> <skill> <true|false>`
printing `NEXT_STEP_CLEAR=<skill>=<value>` (see [plan.md](plan.md#shared-contracts));
`set_next_step_auto.sh` unchanged.

## Implementation Steps

### Step 1 — Widen `init-claude/setup_auto_next.md`

- Intro: the step now configures `next_step.auto.<skill>` and
  `next_step.clear.<skill>` for the three skills.
- Step 1: six `jq` reads, adding `.next_step.clear["<skill>"] // false`; anything
  other than `true` is `false`.
- Step 2: one table, one row per skill — `Skill | Tier | Auto | Clear | Description`.
  A `Clear` cell `true` while `Auto` is `false` renders as
  `true (inactive: auto is off)`; allowed, not blocked. Notes below: what `Clear`
  does (drops the conversation context before the chained command runs; how depends
  on the mod, #797/#798); the inactive note (once, when it applies);
  `/arcanum-check-config` hint naming both keys; the `/arcanum-migrate` override
  sentence applies to the auto keys only — clear keys' other tiers are edited by
  hand for now.
- Step 3: the user edits individual cells (e.g. "discuss-issue clear → true").
- Step 4: write only edited cells, in table order, row by row, auto before clear:
  Auto → `scripts/set_next_step_auto.sh`, Clear → `scripts/set_next_step_clear.sh`
  (document its `NEXT_STEP_CLEAR=` output). Untouched cells never written; a
  non-zero exit is reported and the rest continue.
- Step 5: one report line per written key.

### Step 2 — Skill review

Run the skill-reviewer checks on the changed file (no inline deterministic logic
beyond the existing `jq` reads; no `/dev/tty` script involved).

## Files to Change
- `init-claude/setup_auto_next.md` — the widened table, reads and writes.

## Notes
- Skill-step prose for `next_step_prompt.sh`/`auto_next.sh` callers is not touched
  here (#798).

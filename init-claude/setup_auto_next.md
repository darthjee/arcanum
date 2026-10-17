# Setup Auto-next

Configure, in a single review-and-confirm pass, the `next_step.auto.<skill>` and `next_step.clear.<skill>` keys of three skills: `enhance-issue`, `discuss-issue` and `auto-plan-issue`. The auto key controls whether a skill's end-of-run "next step" offer runs automatically instead of waiting for the user. The clear key controls whether that automatic chained run starts from a cleared conversation context. All six are repo-tier keys, written to `.claude/configuration/arcanum-repo-config.json` (committed), and default to `false`.

## Step 1 — Read current values

Before rendering anything, pre-populate from the repo config:

```bash
jq -r '.next_step.auto["enhance-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.clear["enhance-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.auto["discuss-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.clear["discuss-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.auto["auto-plan-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.clear["auto-plan-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
```

Treat a missing file, a missing key, empty `jq` output or any value other than `true` as `false`.

## Step 2 — Render the table

Show the user a single table with one row per skill and its current values, e.g.:

| Skill | Tier | Auto | Clear | Description |
| --- | --- | --- | --- | --- |
| `enhance-issue` | repo (committed) | `<true/false>` | `<true/false>` | Auto skips the offer to run `/discuss-issue <id>` after `/enhance-issue`. Never applies to an Epic. |
| `discuss-issue` | repo (committed) | `<true/false>` | `<true/false>` | Auto skips the offer to run `/auto-plan-issue <id>` after `/discuss-issue`. |
| `auto-plan-issue` | repo (committed) | `<true/false>` | `<true/false>` | Auto skips the offer to run `/loop /auto-resolve-issue <id>` after `/auto-plan-issue`, once a plan exists. |

When a row's `Clear` is `true` while its `Auto` is `false`, render that `Clear` cell as `true (inactive: auto is off)`. This combination is allowed — don't block it or ask the user to change it.

Below the table, tell the user:

- A `true` `Auto` turns that offer into an automatic chained run.
- A `true` `Clear` drops the conversation context before the chained command runs, so it starts fresh. How the context is dropped depends on the mod in use. `Clear` only takes effect when `Auto` is `true` too.
- Only when at least one row shows `true (inactive: auto is off)`: that `Clear` value is kept but has no effect until the row's `Auto` is turned on.
- These values are committed and shared with every contributor. A user can still override an auto key for their own clone (local state) or for every repo (global config), through `/arcanum-migrate`'s auto-next migrations. Clear keys have no migration yet: their local and global tiers are edited by hand for now.
- `/arcanum-check-config next_step.auto.<skill>` and `/arcanum-check-config next_step.clear.<skill>` show which tier a key's effective value comes from.

## Step 3 — Confirm as a whole

Ask the user if they're satisfied with the table as shown, or which cell(s) they'd like to change (e.g. "discuss-issue clear → true").

- If satisfied with no changes: go to Step 4 with nothing marked as edited.
- If they name cell(s) to change: discuss just those cells (ask for a new `true`/`false` value), update the in-memory draft, re-render the table from Step 2, and ask again. Loop until satisfied. Never restart the whole table implicitly, and never silently no-op a cell the user did ask about.

A cell the user never mentions across this whole pass keeps its current value untouched.

## Step 4 — Apply on confirmation

Once the user confirms the final table, write only the cells that were actually edited during this pass, in table order, row by row, the `Auto` cell before the `Clear` cell.

For each edited `Auto` cell, run:

```bash
scripts/set_next_step_auto.sh "$REPO_PATH" <skill> true|false
```

> Resolve `scripts/set_next_step_auto.sh` relative to the `init-claude` skill folder. `<skill>` is `enhance-issue`, `discuss-issue` or `auto-plan-issue`. On success it prints `NEXT_STEP_AUTO=<skill>=<value>` and exits `0`. It writes `next_step.auto.<skill>` into `.claude/configuration/arcanum-repo-config.json`, creating the file and `.claude/configuration/` if needed.

For each edited `Clear` cell, run:

```bash
scripts/set_next_step_clear.sh "$REPO_PATH" <skill> true|false
```

> Resolve `scripts/set_next_step_clear.sh` relative to the `init-claude` skill folder. `<skill>` is `enhance-issue`, `discuss-issue` or `auto-plan-issue`. On success it prints `NEXT_STEP_CLEAR=<skill>=<value>` and exits `0`. It writes `next_step.clear.<skill>` into `.claude/configuration/arcanum-repo-config.json`, creating the file and `.claude/configuration/` if needed.

Not edited this pass: don't run either script for that cell. If a call exits non-zero, report the error to the user and continue with the other cells.

## Step 5 — Report

Tell the user what was written, one line per written key (e.g. `next_step.auto.enhance-issue` set to `true` in `.claude/configuration/arcanum-repo-config.json`, or `next_step.clear.discuss-issue` set to `true` in `.claude/configuration/arcanum-repo-config.json`), and any key that failed. If the user confirmed the table with no edits, say nothing changed.

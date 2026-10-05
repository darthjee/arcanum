# Setup Auto-next

Configure, in a single review-and-confirm pass, the three `next_step.auto.<skill>` keys. Each key controls whether a skill's end-of-run "next step" offer runs automatically instead of waiting for the user. All three are repo-tier rows, written to `.claude/configuration/arcanum-repo-config.json` (committed), and default to `false`.

## Step 1 — Read current values

Before rendering anything, pre-populate from the repo config:

```bash
jq -r '.next_step.auto["enhance-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.auto["discuss-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
jq -r '.next_step.auto["auto-plan-issue"] // false' "$REPO_PATH/.claude/configuration/arcanum-repo-config.json" 2>/dev/null
```

Treat a missing file, a missing key, empty `jq` output or any value other than `true` as `false`.

## Step 2 — Render the table

Show the user a single table with all three rows and their current values, e.g.:

| Setting | Tier | Current value | Description |
| --- | --- | --- | --- |
| `enhance-issue` | repo (committed) | `<true/false>` | Skips the offer to run `/discuss-issue <id>` after `/enhance-issue`. Never applies to an Epic. |
| `discuss-issue` | repo (committed) | `<true/false>` | Skips the offer to run `/auto-plan-issue <id>` after `/discuss-issue`. |
| `auto-plan-issue` | repo (committed) | `<true/false>` | Skips the offer to run `/loop /auto-resolve-issue <id>` after `/auto-plan-issue`, once a plan exists. |

Below the table, tell the user:

- A `true` key turns that offer into an automatic chained run.
- These values are committed and shared with every contributor. A user can still override a key for their own clone (local state) or for every repo (global config), through `/arcanum-migrate`'s auto-next migrations.
- `/arcanum-check-config next_step.auto.<skill>` shows which tier a key's effective value comes from.

## Step 3 — Confirm as a whole

Ask the user if they're satisfied with the table as shown, or which row(s) they'd like to change.

- If satisfied with no changes: go to Step 4 with nothing marked as edited.
- If they name row(s) to change: discuss just those rows (ask for a new `true`/`false` value), update the in-memory draft, re-render the table from Step 2, and ask again. Loop until satisfied. Never restart the whole table implicitly, and never silently no-op a row the user did ask about.

A row the user never mentions across this whole pass keeps its current value untouched.

## Step 4 — Apply on confirmation

Once the user confirms the final table, write only the rows that were actually edited during this pass, in table order. For each edited row, run:

```bash
scripts/set_next_step_auto.sh "$REPO_PATH" <skill> true|false
```

> Resolve `scripts/set_next_step_auto.sh` relative to the `init-claude` skill folder. `<skill>` is `enhance-issue`, `discuss-issue` or `auto-plan-issue`. On success it prints `NEXT_STEP_AUTO=<skill>=<value>` and exits `0`. It writes `next_step.auto.<skill>` into `.claude/configuration/arcanum-repo-config.json`, creating the file and `.claude/configuration/` if needed. Not edited this pass: don't run the script for that row.

If a call exits non-zero, report the error to the user and continue with the other rows.

## Step 5 — Report

Tell the user what was written, row by row (e.g. `next_step.auto.enhance-issue` set to `true` in `.claude/configuration/arcanum-repo-config.json`), and any row that failed. If the user confirmed the table with no edits, say nothing changed.

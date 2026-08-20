# Setup `auto-fix-all` Settings

Configure, in a single review-and-confirm pass, every scalar/boolean setting `auto-fix-all` reads from this project — one repo-tier row (CI check-ignore patterns, committed) and two local-tier rows (personal run behavior, gitignored).

## Step 1 — Read current values

Before rendering anything, pre-populate from both files:

```bash
jq -r '.["auto-fix-all"].ignored_check_patterns // [] | join(", ")' .claude/configuration/arcanum-repo-config.json 2>/dev/null
jq -r '.["auto-fix-all"].clear_context // false' .claude/state/arcanum-config.json 2>/dev/null
jq -r '.["auto-fix-all"].finish_on_empty_queue // false' .claude/state/arcanum-config.json 2>/dev/null
```

Treat a missing file, a missing key, or empty `jq` output as "none" for the patterns row and `false` for the two boolean rows.

## Step 2 — Render the table

Show the user a single table with all three rows and their current values, e.g.:

| Setting | Tier | Current value | Description |
|---|---|---|---|
| CI check-ignore patterns | repo (committed) | `<patterns, or "none">` | CI check-runs that should never block a PR from being merged when `auto-fix-all` monitors it (e.g. informational bots, code-quality dashboards that don't report a clean pass/fail). Matched case-insensitively as regular expressions against each check-run's name (e.g. `Codacy` matches "Codacy Static Code Analysis"). |
| `clear_context` | local (gitignored) | `<true/false>` | Clear conversation context between issues (via a short `ScheduleWakeup` pause); only takes effect when `auto-fix-all` is invoked through `/loop`. |
| `finish_on_empty_queue` | local (gitignored) | `<true/false>` | Stop the run once the queue empties instead of waiting forever for more issues to be pushed onto it. |

## Step 3 — Confirm as a whole

Ask the user if they're satisfied with the table as shown, or which row(s) they'd like to change.

- If satisfied with no changes: go to Step 4 with nothing marked as edited.
- If they name row(s) to change: discuss just those rows (ask for new pattern list, or a new `true`/`false` value), update the in-memory draft, re-render the table from Step 2, and ask again. Loop until satisfied. Never restart the whole table implicitly, and never silently no-op a row the user did ask about.

An explicit empty/"none" answer on a row that currently has a value is a real edit — it clears that row. A row the user never mentions across this whole pass keeps its current value untouched.

## Step 4 — Apply on confirmation

Once the user confirms the final table, write only the rows that were actually edited during this pass — repo tier first, then local tier:

- **CI check-ignore patterns row**, if edited:
  - One or more patterns given: run
    ```bash
    scripts/set_ci_ignored_patterns.sh "<pattern-1>" ["<pattern-2>" ...]
    ```
  - Explicitly cleared (a "none" answer on a row that had a value, or explicitly clearing an already-empty row): run
    ```bash
    scripts/set_ci_ignored_patterns.sh --clear
    ```
  - Not edited this pass: don't run the script at all.

  > Resolve `scripts/set_ci_ignored_patterns.sh` relative to the `init-claude` skill folder. This writes `ignored_check_patterns` into `.claude/configuration/arcanum-repo-config.json`'s `auto-fix-all` namespace (creating the file, and `.claude/configuration/`, if needed) — see `docs/guides/arcanum-repo-config.md` for the config-file layout. It never touches the legacy `.claude/configuration/auto-fix-all.json` file.

- **`clear_context` / `finish_on_empty_queue` rows**, for each one edited this pass:
  ```bash
  ../auto-fix-all/scripts/config.sh set clear_context true|false
  ../auto-fix-all/scripts/config.sh set finish_on_empty_queue true|false
  ```
  > Resolve `../auto-fix-all/scripts/config.sh` relative to the `init-claude` skill folder. Both keys are routed to `.claude/state/arcanum-config.json`'s `auto-fix-all` namespace (gitignored, not committed). Not edited this pass: don't run the script for that key.

## Step 5 — Report

Tell the user what was written, row by row (e.g. `.claude/configuration/arcanum-repo-config.json` written, ignoring CI check-runs matching: `<pattern-1>, <pattern-2>`; `clear_context` set to `true`; etc.). If the user confirmed the table with no edits and it already matched current state, say nothing changed.

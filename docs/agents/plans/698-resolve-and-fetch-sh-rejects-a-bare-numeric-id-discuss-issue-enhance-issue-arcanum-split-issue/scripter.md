# Scripter Plan: resolve_and_fetch.sh rejects a bare numeric id

Main plan: [plan.md](plan.md)

## Shared contracts

- **Input grammar** (after trimming surrounding whitespace): `^#?([0-9]+)$`. The leading `#` is optional, and `694`, `#694` and `  #694  ` all resolve to `ID=694`. Everything else is still rejected (`""`, `"   "`, `"#"`, `"#abc"`, `"# 1"`, `"#193 - title"`, `"bare title"`, `"193 - title"`).
- **Error output** for rejected input. Both implementations must produce exactly this, byte for byte:

  ```text
  STATUS=error
  ERROR=Error: invalid input '<arg_string>' — expected '<id>' or '#<id>'
  ```

- No other output changes. `STATUS=ok` lines and the fetch-error path stay the same.

## Implementation Steps

### Step 1 — Make the leading `#` optional in the shell implementation
In `arcanum/_lib/resolve_and_fetch_shell.sh`, change the parse regex from `^#([0-9]+)$` to `^#?([0-9]+)$` (`BASH_REMATCH[1]` stays the id). Change `ERROR_MSG` to the exact error text in the shared contract.

### Step 2 — Update the grammar docs in the script headers
Change the header comments that describe the old grammar: in `resolve_and_fetch_shell.sh`, the "Input grammar: ... must match '^#[0-9]+$'" line and the "--- Parse the simplified '#<id>' input grammar ---" comment; in `arcanum/_lib/resolve_and_fetch.sh`, the "Resolves an issue id ('#<id>')" line. They should now describe `<id>` or `#<id>`.

## Files to Change
- `arcanum/_lib/resolve_and_fetch_shell.sh`: regex, error message and comments.
- `arcanum/_lib/resolve_and_fetch.sh`: header comment only.

## Notes
- There is no shell test suite for this script. Check it by hand with `engine.mode=shell`: `arcanum/_lib/resolve_and_fetch_shell.sh <repo> docs/agents/issues 698`, then the same with `"#698"` and `"698 - x"`.

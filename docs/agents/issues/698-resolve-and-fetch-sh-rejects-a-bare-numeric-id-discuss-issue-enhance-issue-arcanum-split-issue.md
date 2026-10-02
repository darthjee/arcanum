# Issue: resolve_and_fetch.sh rejects a bare numeric id (discuss-issue / enhance-issue / arcanum-split-issue)

## Description
`resolve-and-fetch` (shell: `arcanum/_lib/resolve_and_fetch_shell.sh`, native: `core/lib/commands/shared/ResolveAndFetch.js`) only accepts `#<id>`. Running `/discuss-issue 694` with a bare number fails with:

```text
STATUS=error
ERROR=Error: invalid input '694' — expected '#<id>'
```

Found while running `/discuss-issue 694` (see #694).

## Problem
Other skills, such as `/auto-fix-issue` and `/plan-issue`, accept both `5` and `#5`. Their resolver, `resolve_id_and_file`, already handles both forms. `resolve-and-fetch` is shared by `discuss-issue`, `enhance-issue` and `arcanum-split-issue`. All three reject a bare id, so the id format works differently from one skill to the next.

## Expected Behavior
- `resolve-and-fetch` accepts both `<id>` and `#<id>` (surrounding whitespace trimmed) and treats them the same way.
- The shell and native implementations behave the same. The specs cover both forms in each implementation.
- Any other input is still `STATUS=error`. The error message now says `expected '<id>' or '#<id>'`.
- The script headers and comments that describe the `'#<id>'` grammar are updated.
- The `Usage:` lines in the `discuss-issue`, `enhance-issue` and `arcanum-split-issue` SKILL.md descriptions list both forms, as `auto-fix-issue`'s does (`Usage: /discuss-issue <id> or /discuss-issue #<id>`).

## Solution
Make the leading `#` optional in the input pattern (`#?`) in both implementations, and update the error text, comments and specs to match. Then update the three SKILL.md usage lines.

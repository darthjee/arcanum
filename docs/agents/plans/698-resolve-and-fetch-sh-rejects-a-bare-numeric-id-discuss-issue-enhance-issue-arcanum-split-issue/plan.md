# Plan: resolve_and_fetch.sh rejects a bare numeric id (discuss-issue / enhance-issue / arcanum-split-issue)

Issue: [698-resolve-and-fetch-sh-rejects-a-bare-numeric-id-discuss-issue-enhance-issue-arcanum-split-issue.md](../../issues/698-resolve-and-fetch-sh-rejects-a-bare-numeric-id-discuss-issue-enhance-issue-arcanum-split-issue.md)

## Overview
Make the leading `#` optional in the `resolve-and-fetch` input grammar, so `discuss-issue`, `enhance-issue` and `arcanum-split-issue` accept `<id>` as well as `#<id>`, like `plan-issue` and `auto-fix-issue` already do. The shell version (scripter) and the native version (node) must keep giving the same output, and the three SKILL.md usage lines (skill-writer) must document both forms.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [skill-writer](skill-writer.md)

## Shared contracts

- **Input grammar** (after trimming surrounding whitespace): `^#?([0-9]+)$`. The leading `#` is optional, and `694`, `#694` and `  #694  ` all resolve to `ID=694`. Everything else is still rejected (`""`, `"   "`, `"#"`, `"#abc"`, `"# 1"`, `"#193 - title"`, `"bare title"`, `"193 - title"`).
- **Error output** for rejected input. Both implementations must produce exactly this, byte for byte:

  ```text
  STATUS=error
  ERROR=Error: invalid input '<arg_string>' — expected '<id>' or '#<id>'
  ```

- No other output changes. `STATUS=ok` lines and the fetch-error path stay the same.

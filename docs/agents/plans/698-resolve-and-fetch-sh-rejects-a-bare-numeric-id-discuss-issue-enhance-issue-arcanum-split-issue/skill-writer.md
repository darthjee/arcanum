# Skill-writer Plan: resolve_and_fetch.sh rejects a bare numeric id

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

### Step 1 — Document both id forms in the usage lines
In the `description:` frontmatter of each affected SKILL.md, change `Usage: /<skill> #19` to the `auto-fix-issue` form: `Usage: /<skill> <id> or /<skill> #<id>`.
- `discuss-issue/SKILL.md`
- `enhance-issue/SKILL.md`
- `arcanum-split-issue/SKILL.md`

## Files to Change
- `discuss-issue/SKILL.md`, `enhance-issue/SKILL.md`, `arcanum-split-issue/SKILL.md`: `Usage:` text in the description.

## Notes
- The step files that re-run the script with `"#<id>"` (`discuss-issue/steps/extract_id_and_name.md`, `enhance-issue/steps/fetch.md`) still work as they are, so leave them alone.

# Architect Plan: Codacy: markdownlint MD031 cluster — fenced code blocks not surrounded by blank lines (21 findings, 12 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — this file's fix is independent of `skill-writer`'s work (see [plan.md](plan.md)).

## Implementation Steps

### Step 1 — Add blank lines around fenced code blocks in the one non-skill doc

`docs/guides/arcanum-global-config.md` is the only affected file outside any skill's `SKILL.md`/`steps/*.md` scope, so it's owned directly by `architect` rather than `skill-writer` (same split rule used for issue #504). Sweep every fenced code block in the file and ensure a blank line immediately precedes its opening fence and immediately follows its closing fence, except where the block opens/closes the document. This rule is auto-fixable by `markdownlint --fix` — prefer running the formatter (scoped to this file) and reviewing the diff over hand-editing, to avoid missing any of the flagged spots.

## Files to Change

- `docs/guides/arcanum-global-config.md` — add missing blank line(s) around fenced code block(s); no content changes inside any block.

## Notes

- Verify no MD031 findings remain in this file afterward (re-run markdownlint/Codacy, or manually re-check each fence for surrounding blank lines).

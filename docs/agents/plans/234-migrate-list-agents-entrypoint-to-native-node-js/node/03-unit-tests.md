# Unit tests for ListAgents

Add `core/spec/lib/ListAgents_spec.js`, following `SafeBranch_spec.js`/`RepoPath_spec.js`'s style (real temp-dir fixtures via `core/spec/support/utils/tempDir.js`, no filesystem mocking).

Cover:
- Multiple valid agent files → correct `name|description` lines, alphabetical-by-filename order (use filenames that sort differently than their `name:` field values, to prove ordering is filename-based).
- A file missing `name:` → skipped entirely (no line, no crash).
- A file missing `description:` → emitted as `name|` (empty description, trailing pipe with nothing after).
- Frontmatter values wrapped in single quotes and in double quotes → quotes stripped in output.
- A file with no `---` frontmatter block at all → skipped like a missing-`name` file.
- `agentsDir` doesn't exist → `run()` resolves to `''`.
- `agentsDir` exists but has zero `*.md` files → `run()` resolves to `''`.
- Default `agentsDir` (omitted second arg) resolves to `.claude/agents` under `repoPath`.
- Invalid/missing `repoPath` → propagates `RepoPath.validate()`'s thrown `Error` (assert on the message, reusing the same expectations `RepoPath_spec.js` already has for `validate()`, not re-deriving them).

## Files to Change

- `core/spec/lib/ListAgents_spec.js` — new unit test file described above.

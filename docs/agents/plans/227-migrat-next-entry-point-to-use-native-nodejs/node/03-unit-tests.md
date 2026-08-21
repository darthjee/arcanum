# Unit tests

Jasmine specs under `core/spec/`, mirroring `core/lib/`'s Step 01 module layout 1:1 (no fixtures/network needed — this entry point is purely filesystem-based; use real temp directories, per the issue's stated testing rationale). Cover every branch called out in Step 01:

- Scenario A, existing-file match → `STATUS=existing`, correct `FILE`.
- Scenario A, no match → `STATUS=new`, `NEEDS_FETCH=true`, `FILE` built via `title_to_snake_case` (including symbols/uppercase/repeated-separator cases).
- Scenario B (bare title, no `#`) → `STATUS=missing_id`, `ID`/`FILE` empty.
- Scenario C, existing-file match → `STATUS=existing`, `TITLE` derived via `title_from_filename` (both `_` and `-` separated filenames).
- Scenario C, no match → `STATUS=new`, `NEEDS_FETCH=true`, `TITLE`/`FILE` empty.
- Non-numeric id (`#abc`, `#12x`) → the hard-failure path: non-zero exit, no `STATUS=` line, exact error message.
- Existing-file lookup only matches `<id>_*`/`<id>-*` at the top level of `issuesFolder` (not recursively, not a different id's prefix).

## Files to Change

- `core/spec/` (new files, mirroring Step 01's `core/lib/` layout) — the specs described above.

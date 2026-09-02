# Verify spec count and lint

Confirm the split preserved every test with no behavior change:

1. Before deleting the monolith (or from git history / the issue's own description), note the
   original file's total `it` count — 3 preconditions single-scenario `it`s +
   1 "no pull request found" `it` + 3 CI-outcome `it`s + 2 engine_dispatch `it`s = 9 `it`s
   total across the file.
2. Run `make core-test` and confirm it passes, with the same total spec count as before the
   split (no test silently dropped or duplicated across the three new files).
3. Run `make core-lint` and confirm it's clean on the new files and the shared factory module.

If either command fails, fix the split (missing import, misplaced helper, accidentally
modified assertion) rather than changing test behavior — nothing about what's being tested
should differ from the original monolith.

## Files to Change

None — this step only runs verification commands; no further file edits are expected unless a
failure surfaces something to fix in the files from steps 01-04.

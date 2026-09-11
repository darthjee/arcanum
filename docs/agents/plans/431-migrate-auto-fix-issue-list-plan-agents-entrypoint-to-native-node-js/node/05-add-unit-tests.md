# Add native unit tests for AutoFixIssueListPlanAgents

Cover, using real temp-dir fixtures (no filesystem mocking, matching the sibling specs' style):
- `<plan_dir>` does not exist → empty result, exit 0.
- `<plan_dir>` exists but is empty → empty result.
- `<plan_dir>` contains only `plan.md` → empty result (excluded).
- `<plan_dir>` contains `plan.md` plus one or more agent `.md` files (e.g. `backend.md`, `node.md`) → returns the agent names, alphabetically sorted, one per line, `plan.md` excluded.
- Filenames that sort differently by full path vs. bare basename (if constructible) → sorted by the same key the shell script uses (full path via `sort`), to stay parity-safe.
- Non-`.md` files or subdirectories inside `<plan_dir>` → ignored (shell's `*.md` glob only matches files directly in the dir with that extension).

## Files to Change
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueListPlanAgents_spec.js` — new file, native unit tests per the coverage above (matches the location of sibling specs, e.g. `AutoFixIssueCreateBranch_spec.js`).

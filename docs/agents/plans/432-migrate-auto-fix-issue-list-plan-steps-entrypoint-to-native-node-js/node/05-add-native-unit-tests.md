# Add native unit tests

Write `core/spec/commands/auto-fix-issue/AutoFixIssueListPlanSteps_spec.js`, mirroring `AutoFixIssueListPlanAgents_spec.js`'s structure (fake/injected `readdir`, no real filesystem access needed for the core cases, plus real temp-dir fixtures if that's how the sibling spec covers sorting). Cover:

- Missing `planDir` and missing `agentName` each throw the usage error.
- `<planDir>/<agentName>` doesn't exist → resolves to `''`.
- `<planDir>/<agentName>` exists but has no `.md` files → resolves to `''`.
- Multiple `.md` files → resolves to newline-joined, alphabetically-sorted `<planDir>/<agentName>/<file>` paths with a trailing newline.
- Non-`.md` files in the directory are excluded.
- Sorting is by filename (verify with filenames whose full-path sort order would differ if sorted some other way, if applicable).

## Files to Change
- `core/spec/commands/auto-fix-issue/AutoFixIssueListPlanSteps_spec.js` — new file.

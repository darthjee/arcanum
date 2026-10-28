# Add the migration-reference convention spec
Add a spec that scans every file under `core/spec/` (recursively, skipping `node_modules/`) and fails when any line contains a migration reference that a version bump cannot rewrite:

1. **Pending-manifest literal:** the text `repos/next/migrations.json`.
2. **Segment assembly:** a `'repos'` string immediately followed by a `'next'` string as consecutive arguments, in either quote style and with any whitespace (e.g. `'repos', 'next'`, `"repos","next"`).

Requirements:

- Build both patterns from pieces (e.g. `['repos', 'next'].join('/')`, `new RegExp(...)` from fragments), so the spec's own source never contains either forbidden text and no self-exclusion is needed.
- On failure, report every hit as `<path relative to REPO_ROOT>:<line>: <matched text>` in the expectation message. For example, collect the hits and `expect(hits).toEqual([])` so Jasmine prints them.
- Use `node:fs/promises` (`readdir` with `recursive: true`, or a small walk) and `REPO_ROOT` from `../support/utils/runCommand.js`. Zero new dependencies.
- The header comment cites issue #892 and the Spec convention in `docs/agents/architecture/per-repo-migrations.md`, and states the known limitation: template literals and variables that hold `'next'` are not detected.
- After step 01 the current tree is clean, so the spec must pass with no allowlist.
- Optional while implementing, not committed: plant a violation in a temp file under `core/spec/`, confirm the failure names it as `<file>:<line>`, then remove it.

Follow `core/eslint.config.mjs`: JSDoc on helper functions, single quotes, no `console.log`.

## Files to Change
- `core/spec/bin/migrationSpecReferences_spec.js` (new) — the convention spec.

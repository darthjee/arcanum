# Node Plan: Codacy: duplication cluster — PermissionGrant_spec.js internal self-duplication

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Parameterize the five duplicated grant/assert tests

In `core/spec/lib/commands/shared/PermissionGrant_spec.js`, replace these five `it(...)` blocks under `describe('#add', ...)`:

- `creates the file (starting from {}) when it does not exist yet`
- `resolves a repo-relative file against the context anchor, not process.cwd()`
- `dedupes when the pattern is already present`
- `treats missing/invalid JSON in an existing file as {}`
- `treats an existing but empty file as {}`

with a single `it.each([...])(...)`-driven test. Each entry needs:
- a short case description (used as the test name),
- an optional setup step — what (if anything) to `mkdir`/`writeFile` into `file` before calling `add` (none, `JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } })`, `'not json'`, or `''`),
- the target to pass into `add` — either the absolute `file` path or the repo-relative string `'.claude/settings.json'`.

The shared body after parameterization: construct `new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) })`, run the optional setup, `await permissionGrant.add(target, 'Bash(git push:*)')`, then assert `JSON.parse(await readFile(file, 'utf8'))` equals `{ permissions: { allow: ['Bash(git push:*)'] } }`.

Do **not** touch the other four tests in the file (`leaves every other top-level key... untouched`, `degrades silently...`, `acquires and releases the lock...`, `does not corrupt the file under two near-simultaneous writes`) — they have distinct arrangements/assertions and are out of scope for this duplication cluster. Also do not attempt to address the cross-file clone overlap Codacy reports with `AutoFixAllConfig_spec.js` / `AutoFixAllQueuePop_spec.js` — out of scope for this issue.

## Files to Change

- `core/spec/lib/commands/shared/PermissionGrant_spec.js` — collapse the five duplicated tests into one `it.each`-parameterized test; leave the remaining four tests as-is.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Coverage must stay unchanged after the refactor (all five original scenarios must still be exercised individually via the parameterized cases).
- The original GitHub issue text described the duplication as varying by permission name; it actually varies by initial file state and `add()` target — this was corrected during discussion (see the issue file's Problem section).

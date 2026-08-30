# Rework PermissionGrant_spec.js onto #add

The spec currently drives everything through `permissionGrant.run(...)` under a
`describe('#run')` block. Point it at `add` directly and drop the action guard
coverage.

- Rename the outer `describe('#run', …)` (line ~23) to `describe('#add', …)`.
- Delete the entire `describe('an unrecognized or missing action', …)` block
  (lines ~24–40) — the two `it(...)` cases (`run('remove', …)` rejects,
  `run(undefined, …)` rejects) no longer apply; there is no usage-message path.
- In `describe('the "add" action', …)` (line ~42 onward), change every
  `permissionGrant.run('add', <file>, <pattern>)` call to
  `permissionGrant.add(<file>, <pattern>)` (drop the `'add'` first arg). This
  affects the calls at lines ~46, 56, 75, 94, 107, 120, 137, 152, 163, 164.
  Consider flattening the now-redundant `the "add" action` sub-describe up into
  `#add` if it reads cleanly, but a mechanical rename is acceptable.
- Remove any now-unused import/reference to the usage-message string if the spec
  imported or re-declared it.

## Files to Change

- `core/spec/lib/commands/PermissionGrant_spec.js` — `#run` → `#add`, delete the
  unrecognized/missing-action describe, rewrite the `run('add', …)` call sites as
  `add(…)`.

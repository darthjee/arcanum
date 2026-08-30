# Drop run and USAGE_MESSAGE from PermissionGrant

`add(file, pattern)` is already the real implementation and becomes the directly
dispatched method (see step 01). `run` is now a dead internal-dispatch wrapper.

- Delete the module-level `const USAGE_MESSAGE = 'Usage: permission_grant.sh add <file> <pattern>';`
  (line 5). It is only referenced by `run`.
- Delete the `async run(action, file, pattern)` method (lines ~34–53) together
  with its JSDoc block.
- `add`, `_merge`, `_read`, the constructor, and imports are unchanged.
- Tidy the class-level JSDoc (lines ~7–20): it says "Native equivalent of …
  `permission_grant.sh add <file> <pattern>`" and "Native implementation of the
  `permission-grant` migrated entrypoint". Update the entrypoint name to
  `permission-grant-add` and drop any wording that implies an `action` argument /
  usage-message path. Keep the `context: 'claude'` / anchor-stripping explanation —
  it is still accurate. Do not rewrite the whole block.

## Files to Change

- `core/lib/commands/PermissionGrant.js` — remove `USAGE_MESSAGE` and `run`;
  light JSDoc touch-ups.

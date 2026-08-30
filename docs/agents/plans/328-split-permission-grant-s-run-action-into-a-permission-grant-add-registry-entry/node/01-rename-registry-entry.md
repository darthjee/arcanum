# Rename the registry entry to permission-grant-add

Replace the `'permission-grant'` entry in the `COMMANDS` registry with a
dedicated `'permission-grant-add'` entry that maps straight to the verb method,
bringing it in line with every other multi-verb command.

- Change the key `'permission-grant'` → `'permission-grant-add'`.
- Change `method: 'run'` → `method: 'add'`.
- Keep `context: 'claude'` unchanged (#321 has landed; `PermissionGrant` is
  `ClaudeContext`-injected).
- Keep the entry on its own single line, matching its current formatting.
- In the `@typedef {object} CommandEntry` JSDoc, the `'claude'` bullet currently
  ends `Only \`permission-grant\`.` — update it to `Only \`permission-grant-add\`.`

## Files to Change

- `core/lib/core/commands.js` — registry entry at line ~206 (key, `method`); the
  `context` typedef `'claude'` bullet at line ~29.

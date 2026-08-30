# Update commands_spec.js assertion

The registry spec has one `permission-grant` assertion.

- `it('sets context: \'claude\' on permission-grant', …)` (line ~51):
  - Rename to `it('sets context: \'claude\' on permission-grant-add', …)`.
  - `expect(COMMANDS['permission-grant'].context).toBe('claude')` →
    `expect(COMMANDS['permission-grant-add'].context).toBe('claude')`.
  - Add `expect(COMMANDS['permission-grant-add'].method).toBe('add')` so the
    method-name change is locked in (the whole point of the issue), unless a
    nearby table-driven test already covers every entry's `method`.
- Grep the rest of the file for `permission-grant` in case a table-driven
  `forEach` or a "known commands" list enumerates it, and update that too.

## Files to Change

- `core/spec/lib/core/commands_spec.js` — the `context: 'claude'` assertion (key,
  `it` label, optional `method` assertion).

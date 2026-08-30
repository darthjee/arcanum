# Update dispatcher_spec.js context: 'claude' cases

Three spots in `core/spec/lib/core/dispatcher_spec.js` reference the old command
name and the `add`-token arg shape.

1. `describe('context: \'claude\' path (permission-grant)', …)` (line ~74):
   - Update the describe label to `permission-grant-add`.
   - `new Dispatcher('permission-grant', ['/fake/anchor', 'add', '/tmp/x.json', 'Bash(x)'])`
     (lines ~78–81) → `new Dispatcher('permission-grant-add', ['/fake/anchor', '/tmp/x.json', 'Bash(x)'])`
     (drop `'add'`).
   - The `expect(dispatcher.commandArgs()).toEqual(['add', '/tmp/x.json', 'Bash(x)'])`
     (line ~95) → `toEqual(['/tmp/x.json', 'Bash(x)'])`.
   - The `ClaudeContext` / `args[0]` assertions (lines ~86–91) are unchanged.

2. `describe('claudeContext getter', …)` (line ~113): both
   `new Dispatcher('permission-grant', ['/fake/anchor'])` calls (lines ~115, ~121)
   → `'permission-grant-add'`.

3. `it('never validates a context: \'claude\' entry', …)` (line ~251):
   `new Dispatcher('permission-grant', ['/no/such/path', 'add', '/tmp/x.json', 'Bash(x)'], { … })`
   → `new Dispatcher('permission-grant-add', ['/no/such/path', '/tmp/x.json', 'Bash(x)'], { … })`
   (rename + drop `'add'`). Check the stubbed module in that test's deps — if it
   stubs `{ run: async () => … }`, change it to `{ add: async () => … }` so the
   dispatched method name matches the new registry entry.

## Files to Change

- `core/spec/lib/core/dispatcher_spec.js` — command strings, constructor args,
  `commandArgs()` expectation, and the stubbed method name in the
  never-validates test.

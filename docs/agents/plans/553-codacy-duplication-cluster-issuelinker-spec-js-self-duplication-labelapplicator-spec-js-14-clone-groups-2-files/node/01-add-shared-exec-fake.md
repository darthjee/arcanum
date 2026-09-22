# Add the shared execFileAsync fake
Create `core/spec/support/utils/fakeExecFileAsync.js` exporting `fakeExecFileAsync(command, routes)`:

- `command` is the only command name the fake accepts (`'gh'` or `'git'`). Any other `cmd` throws `new Error(\`unexpected command: ${cmd}\`)`.
- `routes` is an ordered array of `{ match(args, options), respond(args, options) }`. The first route whose `match` returns truthy wins, and its `respond` result (sync or async) is returned. `respond` can throw to simulate a failure.
- If no route matches, it throws `new Error(\`unexpected ${command} invocation: ${JSON.stringify(args)}\`)`, matching today's messages exactly.
- It returns `jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args, options = {}) => ...)`, so `.calls.all()` / `toHaveBeenCalledWith` keep working.

Optionally add a tiny `subcommand(...names)` matcher helper, e.g. matching `args[0] === 'issue' && args[1] === 'view'`, if it reads more clearly than inline predicates. Keep it minimal. Document the export with JSDoc like the neighbouring utils.

## Files to Change
- `core/spec/support/utils/fakeExecFileAsync.js` — new shared fake.

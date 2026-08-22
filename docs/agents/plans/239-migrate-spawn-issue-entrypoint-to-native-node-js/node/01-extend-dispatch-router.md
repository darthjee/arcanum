# Extend the dispatch router for a stdout-plus-exit-1 result

`core/bin/arcanum`'s `dispatch()` currently supports exactly two outcomes: a module method returns a string (printed to stdout, exit 0), or it throws (caught, printed as `arcanum: <message>` to stderr, exit code set to 1). `spawn_issue.sh`'s failure case — retry budget exhausted on `create` — needs a third shape: `STATUS=failed\n` printed to **stdout**, with exit code 1, and nothing on stderr beyond the retry-loop warnings already written along the way.

Add a small dedicated exception type for this, e.g. `core/lib/DispatchFailure.js`:

```js
class DispatchFailure extends Error {
  constructor(stdout) {
    super('dispatch failure');
    this.stdout = stdout;
  }
}
```

`SpawnIssue.js#run` throws `new DispatchFailure('STATUS=failed\n')` instead of returning a string when `create`'s retries are exhausted. Update `dispatch()`'s catch handler: if `error instanceof DispatchFailure`, write `error.stdout` to `process.stdout` and set `process.exitCode = 1` **without** writing the `arcanum: ` stderr line; otherwise keep today's behavior unchanged for every other module (a bare `Error` still goes to stderr).

This is a generic router capability, not spawn-issue-specific — document it in `docs/agents/architecture/script-engine.md`'s dispatch-contract section as the pattern any future entrypoint with a "print to stdout, still fail" shape should reuse, rather than reinventing a one-off flag.

## Files to Change
- `core/lib/DispatchFailure.js` — new, minimal exception carrying its intended stdout payload.
- `core/bin/arcanum` — `dispatch()`'s catch block gains the `DispatchFailure` special case described above; the `COMMANDS` registry entry itself is added in step 03.
- `docs/agents/architecture/script-engine.md` — document the new `DispatchFailure` mechanism alongside the existing dispatch-contract description.

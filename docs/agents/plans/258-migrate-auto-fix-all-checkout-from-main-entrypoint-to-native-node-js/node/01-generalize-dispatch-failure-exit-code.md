# Generalize DispatchFailure's exit code

`core/lib/DispatchFailure.js` currently hardcodes exit `1` for its "print to stdout, still fail" shape (see its own class doc comment and `script-engine.md`'s dispatch-contract section). This entrypoint needs exit `2` for the conflict path, so generalize rather than adding a parallel one-off exception type.

Add an optional second constructor parameter, `exitCode`, defaulting to `1` — every existing caller (`SpawnIssue.js`'s retry-budget-exhausted path, per its spec) keeps working unchanged since it never passes a second argument. Store it as `this.exitCode`.

In `core/bin/arcanum`, the `dispatch(...).catch(...)` handler currently does:

```js
if (error instanceof DispatchFailure) {
  process.stdout.write(error.stdout);
  process.exitCode = 1;
  return;
}
```

Change `process.exitCode = 1` to `process.exitCode = error.exitCode ?? 1`. Nothing else in that branch changes — no `arcanum: ` stderr line either way, same as today.

Update `DispatchFailure.js`'s class doc comment to describe the new parameter (mirroring the JSDoc style already used on its constructor).

## Files to Change

- `core/lib/DispatchFailure.js` — add the optional `exitCode` constructor parameter (default `1`) and store it; update the class/constructor JSDoc.
- `core/bin/arcanum` — catch handler uses `error.exitCode ?? 1` instead of the hardcoded `1`.

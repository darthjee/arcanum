# Reduce core/bin/arcanum to a thin entrypoint

With `COMMANDS` (step 01) and all dispatch logic (step 03) extracted,
`core/bin/arcanum` becomes just: parse argv → run the `Dispatcher` → print a
string result → enforce the error/exit-code contract.

## What to do

1. Delete the inline `COMMANDS` object, the `dispatch()` function, and the
   `libDir` / `configChainPath` consts (now in `dispatcher.js`).
2. Keep only these imports: `Dispatcher` from `../lib/core/dispatcher.js`, and
   `DispatchFailure` from `../lib/utils/errors/DispatchFailure.js`.
   `InvocationLog`, `path`, and `node:url` helpers are no longer needed here.
3. New body:

   ```js
   const [command, ...args] = process.argv.slice(2);

   new Dispatcher(command, args)
     .dispatch()
     .then((output) => {
       if (typeof output === 'string') {
         process.stdout.write(output);
       }
     })
     .catch((error) => {
       if (error instanceof DispatchFailure) {
         process.stdout.write(error.stdout);
         process.exitCode = error.exitCode ?? 1;
         return;
       }

       process.stderr.write(`arcanum: ${error.message}\n`);
       process.exitCode = 1;
     });
   ```

4. Update the top-of-file comment block to describe the new shape (entrypoint
   delegates to `core/lib/core/dispatcher.js`; registry lives in
   `core/lib/core/commands.js`).
5. Preserve exactly: `DispatchFailure` → its `stdout` + `exitCode ?? 1`, no
   stderr; any other error (including the unknown-command `Error` now thrown by
   `Dispatcher`) → `arcanum: <message>\n` on stderr + exit 1; a non-string /
   `undefined` result prints nothing.

## Verification

- `core/spec/bin/arcanum_spec.js` must pass unchanged — `dispatch-fixture`
  success, `dispatch-fixture-crash`, unknown command, and all five
  invocation-logging cases.
- All `core/spec/bin/*Parity_spec.js` must pass unchanged.

## Files to Change

- `core/bin/arcanum` — full rewrite to the thin entrypoint above; remove
  `COMMANDS`, `dispatch()`, `libDir`, `configChainPath`, and now-unused imports.

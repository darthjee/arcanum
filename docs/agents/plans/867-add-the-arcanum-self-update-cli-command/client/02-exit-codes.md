# Exit codes 8 and 130

Add to `cli/lib/exitCodes.js`, never renumbering existing codes:

- `EXIT_NPM = 8`, identifier `npm`, and `NpmError` (`CliError` subclass, exit `8`, code `NPM`). It carries an optional `npmOutput` (the last 10 lines of npm's stderr) that `reportError` prints after the `arcanum: ...` / `hint:` lines in human mode (and leaves out of the JSON error object, or adds it as an extra field only if the existing JSON contract allows; keep the stable `{"error":{"code","exit","message","hint"}}` shape).
- `EXIT_INTERRUPTED = 130`, identifier `interrupted`, and `InterruptedError` (`CliError` subclass, exit `130`, code `INTERRUPTED`).

`exitCodeForError` already returns a `CliError`'s own `exit` before the errno check, so a wrapped spawn `ENOENT` maps to `8`, not `7`. Spec it.

## Files to Change
- `cli/lib/exitCodes.js` — the two codes, identifiers and error classes.
- `cli/lib/output.js` — print `NpmError`'s captured npm lines after the error in human mode, if `reportError` needs a change for it.
- `cli/spec/lib/exitCodes_spec.js` — `8`/`npm`, `130`/`interrupted`, and a wrapped `ENOENT` mapping to `8`.
- `cli/spec/lib/output_spec.js` — the npm lines after the error (if `output.js` changes).

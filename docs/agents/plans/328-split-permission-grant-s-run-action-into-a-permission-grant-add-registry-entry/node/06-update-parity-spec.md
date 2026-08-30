# Update permissionGrantParity_spec.js

This spec runs the real shell script and the native bin against identical inputs
and asserts byte-identical results. It must track both the command rename and the
dropped `add` token, and lose the unrecognized-action case.

- In `runBoth` (lines ~64–72):
  - shell: `runCommand(['bash', SHELL_SCRIPT, cwd, 'add', shellFile, pattern], cwd)`
    → `runCommand(['bash', SHELL_SCRIPT, cwd, shellFile, pattern], cwd)` (drop `'add'`).
  - native: `runCommand([process.execPath, NATIVE_BIN, 'permission-grant', cwd, 'add', nativeFile, pattern], cwd)`
    → `runCommand([process.execPath, NATIVE_BIN, 'permission-grant-add', cwd, nativeFile, pattern], cwd)`
    (rename + drop `'add'`).
- Delete the entire `describe('an unrecognized action', …)` block (lines ~168–185):
  the shell side no longer has a `*)` usage branch and the native side no longer
  has `run`/`USAGE_MESSAGE`, so there is nothing to hold in parity. Remove the
  `runCommand` calls with `'remove'` and the `Usage:` / `add <file> <pattern>`
  stderr assertions.
- Update the file header comment block (lines ~8–32): the entrypoint name
  (`permission-grant` → `permission-grant-add`), the "leading `add`" passthrough
  description, and the paragraph about the usage message not being reproducible
  verbatim (that assertion is gone). Keep the `context: 'claude'` / anchor
  explanation.
- The three positive parity describes (`file does not exist`, `exists with
  unrelated content`, `pattern already present`) keep their assertions unchanged
  aside from going through the updated `runBoth`.

## Files to Change

- `core/spec/bin/permissionGrantParity_spec.js` — `runBoth` invocation shapes,
  delete the unrecognized-action describe, refresh the header comment.

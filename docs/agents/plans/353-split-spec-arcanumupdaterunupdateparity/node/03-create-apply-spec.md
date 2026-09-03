# Create apply_spec.js

Create `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js`, containing the original
file's `describe('apply', ...)` block (all 4 `it`s, verbatim — `RESULT=updated`, `RESULT=noop`,
bootstrap failure exit code, `STATUS=missing_arcanum`), flattened to a single top-level describe:

```js
describe('arcanum-update-run-update-check/-apply parity (shell vs. native) — apply', () => {
  // the 4 `it`s, unchanged
});
```

(drop the original's outer wrapping describe, same flattening convention as `check_spec.js` /
every sibling split.)

Imports needed:
- `writeFile` from `node:fs/promises` and `path` from `node:path` (used directly by 3 of the 4
  `it`s to write fixture marker files and join paths).
- `process` is a Node global — `process.execPath` needs no import.
- From `../../support/factories/arcanumUpdateRunUpdateParitySetup.js` (note the `../../` depth,
  same as `check_spec.js`): `createZipFixture`, `runCommand`, `runPair`, `SHELL_SCRIPTS`,
  `NATIVE_BIN`, `NATIVE_COMMANDS` — this file references `SHELL_SCRIPTS.apply`, `NATIVE_BIN`,
  and `NATIVE_COMMANDS.apply` **directly** in 3 of its 4 `it`s (only the last, `missing_arcanum`,
  goes through `runPair`), so unlike `check_spec.js` this file needs those three constants
  exported from the setup module and imported here.
- `createTempDir`, `removeTempDir` from `../../support/utils/tempDir.js`.

Give the file its own trimmed header comment cross-referencing `check_spec.js` for the other
subcommand's scenarios, same style as step 02.

## Files to Change

- `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` — new file, the `apply` half of the
  original spec.

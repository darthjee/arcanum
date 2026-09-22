# Dedupe apply_spec.js

Replace each of the 4 `it(...)` bodies in `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` with a call to `itMatchesParity` (from Step 1).

**Last test (`missing_arcanum`)** follows the same single-dir/`runPair` shape as `check_spec.js` — same treatment as Step 2, with `expected = { code: 1, stdout: 'STATUS=missing_arcanum\n' }` and `cleanup: () => removeTempDir(dir)`.

**First three tests** (`RESULT=updated`, `RESULT=noop`, bootstrap failure) keep their existing dual-dir setup unchanged inside `run`: create `shellDir`/`nativeDir` via `createZipFixture`, write whatever fixture files the scenario needs (`.fixture-new-version` or `.fixture-fail`) into both, then run shell and native manually via `runCommand` (not `runPair`, since each side uses its own dir):

```js
run: async () => {
  const shellDir = await createZipFixture(...);
  const nativeDir = await createZipFixture(...);
  await writeFile(path.join(shellDir, '<fixture-file>'), ...);
  await writeFile(path.join(nativeDir, '<fixture-file>'), ...);

  const shell = await runCommand([SHELL_SCRIPTS.apply, shellDir], shellDir);
  const native = await runCommand([process.execPath, NATIVE_BIN, NATIVE_COMMANDS.apply, nativeDir], nativeDir);

  return {
    shell,
    native,
    cleanup: async () => {
      await removeTempDir(shellDir);
      await removeTempDir(nativeDir);
    }
  };
}
```

Expected values per scenario:

- `RESULT=updated`: `expected = { code: 0, stdout: 'bootstrap: starting\nbootstrap: done\nRESULT=updated FROM=1.0.0 TO=1.1.0\n' }`
- `RESULT=noop`: `expected = { code: 0, stdout: 'bootstrap: starting\nbootstrap: done\nRESULT=noop VERSION=1.0.0\n' }`
- bootstrap failure: `expected = { code: 9, stdout: 'bootstrap: starting\n' }`

## Files to Change

- `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` — replace all 4 test bodies with `itMatchesParity` calls.

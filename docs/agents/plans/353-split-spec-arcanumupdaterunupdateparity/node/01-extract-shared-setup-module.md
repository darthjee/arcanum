# Extract shared setup module

Create `core/spec/support/factories/arcanumUpdateRunUpdateParitySetup.js` and move the following
out of `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` **verbatim** (bodies unchanged, only
adjusting relative import paths for the module's new location one level deeper):

- Module-level constants: `REPO_ROOT`, `SCRIPTS_DIR`, `NATIVE_BIN`, `BOOTSTRAP_STUB`,
  `SHELL_SCRIPTS`, `NATIVE_COMMANDS`.
- Helper functions (with their existing JSDoc comments): `runCommand`, `runPair`,
  `installBootstrapStub`, `createZipFixture`, `git`, `createGitFixture`.
- The imports these depend on: `execFile` (`node:child_process`), `chmod`/`mkdir`/`readFile`/
  `writeFile` (`node:fs/promises`), `path`, `fileURLToPath` (`node:url`), `promisify`
  (`node:util`), `createTempDir` (`../support/utils/tempDir.js`, becomes `../utils/tempDir.js`
  from the new location), and `execFileAsync = promisify(execFile)`.

Export everything the two new spec files need to import: `runCommand`, `runPair`,
`installBootstrapStub`, `createZipFixture`, `git`, `createGitFixture`, `SHELL_SCRIPTS`,
`NATIVE_BIN`, `NATIVE_COMMANDS` — `apply_spec.js` (step 03) uses `SHELL_SCRIPTS`, `NATIVE_BIN`,
and `NATIVE_COMMANDS` directly, not only through `runPair`, so these three constants must be
exported too, not just the six functions.

Follow the naming convention already used by every sibling parity split (e.g.
`core/spec/support/factories/autoFixAllWaitCiParitySetup.js`,
`core/spec/support/factories/queueParitySetup.js`): `<name>ParitySetup.js`, plain named exports
(`export const ...` / `export async function ...`), no default export.

## Files to Change

- `core/spec/support/factories/arcanumUpdateRunUpdateParitySetup.js` — new file, holds the
  constants and helpers moved verbatim from the original spec.

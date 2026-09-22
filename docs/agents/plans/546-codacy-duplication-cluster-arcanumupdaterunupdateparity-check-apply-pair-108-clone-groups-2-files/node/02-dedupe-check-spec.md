# Dedupe check_spec.js

Replace each of the 4 `it(...)` bodies in `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` with a call to `itMatchesParity` (from Step 1), removing the hand-written `expect` block and `try`/`finally`/`removeTempDir` boilerplate from every test.

Each call's `run` closure keeps that test's existing fixture creation (`createZipFixture`, `createGitFixture`, or `createTempDir`) and `runPair('check', dir, dir)` call unchanged — only the assertion/cleanup scaffolding moves into the shared helper:

- zip fixture: `expected = { code: 0, stdout: 'METHOD=zip\nREPO=darthjee/arcanum-fixture\nCURRENT=1.0.0\nTARGET=${dir}\n' }`
- tagged git fixture: `expected = { code: 0, stdout: 'METHOD=git\nREPO=darthjee/arcanum-fixture\nCURRENT=v1.0.0\nTARGET=${dir}\n' }`
- untagged git fixture: `expected = { code: 0, stdout: /^METHOD=git\nREPO=darthjee\/arcanum-fixture\nCURRENT=[0-9a-f]{7,}\nTARGET=${dir}\n$/ }` (regex — `itMatchesParity` must use `toMatch` for this one)
- missing bootstrap.sh: `expected = { code: 1, stdout: 'STATUS=missing_arcanum\n' }`

Each `run` closure's `cleanup` is `() => removeTempDir(dir)`.

Keep the file's existing top-level `describe` block and imports (dropping `createTempDir`/`removeTempDir` re-exports only if they become unused after the refactor — check before removing).

## Files to Change

- `core/spec/bin/arcanumUpdateRunUpdateParity/check_spec.js` — replace all 4 test bodies with `itMatchesParity` calls.

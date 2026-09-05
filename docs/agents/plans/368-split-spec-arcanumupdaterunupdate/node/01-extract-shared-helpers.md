# Extract shared helpers into a factory module

Create `core/spec/support/factories/arcanumUpdateRunUpdate.js` and move into it, verbatim
(same signatures, same behavior, only JSDoc comments preserved), the 6 helpers and 4 path
constants currently inlined at the top of
`core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` (lines 6–113):

- Constants: `REPO_PATH`, `BOOTSTRAP_PATH`, `ARCANUM_JSON_PATH`, `GIT_DIR_PATH` (the last three
  built via `path.join`, so the module needs its own `import path from 'node:path'`).
- `fakeExistsSync(existingPaths)` — spy answering only the probed paths.
- `fakeReadFile(sequence)` — spy returning one entry from `sequence` per call.
- `fakeExecFileAsync(handlers)` — spy dispatching on a matcher list; no extra import needed.
- `fakeSpawn(exitCode)` — spy returning an `EventEmitter` that emits `'close'`; the module
  needs its own `import { EventEmitter } from 'node:events'` for this.
- `stubDeps(overrides)` — composes the four fakes above into a default collaborator set; its
  default `existsSync` depends on `BOOTSTRAP_PATH`, so keep this helper in the same module as
  the constants.
- `catchError(fn)` — generic async-error-capturing helper; confirmed (via `grep -rl catchError
  core/spec/support/`) that no equivalent already exists under `core/spec/support/utils/`, so
  this is a new addition, not a duplicate.

Export all 10 symbols (6 helpers + 4 constants) as named exports.

## Files to Change

- `core/spec/support/factories/arcanumUpdateRunUpdate.js` — new file; content as described
  above, copied from `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js`
  lines 1–113 with no behavior change.

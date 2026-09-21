# Add shared dispatch-routing helpers

Create the two pieces of shared infrastructure the GitHub-fixture-based specs will consume in later steps.

1. `core/spec/support/utils/engineMode.js` — export `async function seedEngineMode(repo, mode)`, moved verbatim (same signature: `repo.repoPath`, `mode` is `'shell'`/`'native'`) from the identical inline helper duplicated today in `autoFixIssueGithubParity/engine_dispatch_spec.js` and `autoFixAllWaitCiParity/engine_dispatch_spec.js`. Writes `.claude/state/arcanum-config.json` under `repo.repoPath` with `{ engine: { mode } }`, creating the `.claude/state` directory first.

2. `core/spec/support/sharedExamples/engineDispatchRouting.js` — export a shared example, e.g. `itRoutesEngineDispatch(description, shimScript, prepare, { shell, native })`, modeled on the existing flexible-callback shape of `itRejectsMissingArgument`/`itRejectsInvalidRepoPath` in `core/spec/support/sharedExamples/cliParityValidation.js`:
   - Registers a `describe(description, ...)` block with two `it`s: `'routes to the shell implementation when engine.mode=shell'` and `'routes to the native implementation when engine.mode=native'`.
   - Each `it` creates a fixture repo (`createGitFixtureRepo`), calls `seedEngineMode(repo, mode)`, then calls the caller-supplied `prepare(repo, mode)` async callback — which does whatever per-case fixture setup a given subcommand needs (e.g. `seedGithubLikeRepo`, a `fakeGh` binary, writing an extra file) and returns `{ args, env, cleanup }` (`args` appended to `[shimScript, ...args]` for `runCommand`, `env` optional, `cleanup` optional for e.g. `fakeGh.cleanup()`).
   - Runs `runCommand([shimScript, ...args], repo.repoPath, env)` and passes the result to the caller-supplied `shell(result)`/`native(result)` assertion callback for that mode.
   - Always tears down `repo.cleanup()` and any `cleanup()` from `prepare` in a `finally`, mirroring every existing spec's try/finally shape.
   - Document the exported function with JSDoc in the same style as `cliParityValidation.js` (param types, what each callback receives/returns).

## Files to Change

- `core/spec/support/utils/engineMode.js` — new file, `seedEngineMode(repo, mode)`.
- `core/spec/support/sharedExamples/engineDispatchRouting.js` — new file, `itRoutesEngineDispatch(...)`.

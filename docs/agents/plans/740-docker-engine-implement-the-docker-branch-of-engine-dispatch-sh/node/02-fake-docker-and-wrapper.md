# Fake docker binary and wrapper overrides

- `core/spec/support/utils/fakeDockerBin.js`: `createFakeDockerBin({ mode: 'scripted' | 'passthrough', ...options })` writes an executable `docker` into a fresh temp dir and returns `{ binDir, readCalls(), cleanup() }`. Options are baked into the script at build time, like `fakeGhBin`'s `authTokenAlwaysFails`, so they survive any env the dispatch path uses. Every invocation appends its full argv (one JSON array per line) to a log file that `readCalls()` parses. It also records the values of the `-e` names it sees, so specs can check a value arrived without it ever being in argv.
  - **Scripted**: per subcommand (`inspect`, `pull`, `build`, `run`), an exit code plus optional stdout and stderr. Include the daemon-error stderr (`Cannot connect to the Docker daemon ...`) as a preset.
  - **Passthrough** (for `run`): validates the argv shape, then execs the repo's real `core/bin/arcanum` with the args after the image and an env built from the `-e` names. Image-acquisition subcommands succeed. This is the mode #741's routing assertion reuses.
- `core/spec/support/utils/engineDispatchLib.js`: let `runEngineDispatchFn` also override `_ENGINE_DISPATCH_INSTALL_ROOT` and `_ENGINE_DISPATCH_DOCKER_IMAGE` (optional, empty means "keep the lib default"), still as sourced variables in the `bash -c` wrapper. Add a `runEngineDispatch(...)` convenience if the spec needs one.

## Files to Change

- `core/spec/support/utils/fakeDockerBin.js` — new fake.
- `core/spec/support/utils/engineDispatchLib.js` — wrapper overrides.

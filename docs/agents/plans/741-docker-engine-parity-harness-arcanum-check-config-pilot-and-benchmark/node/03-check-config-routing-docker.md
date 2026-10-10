# Pilot routing spec docker callback

Once `arcanum-check-config` is `"docker"` in `migration-status.json`, replace the `with engine.mode docker` describe in `core/spec/bin/arcanumCheckConfig_spec.js`. Its current case expects the "not docker-ready yet" warning and no docker call. Implement the docker-ready path as testing.md's "Shim-level specs" describes. This spec doesn't use `itRoutesEngineDispatch`, because the command is native-only with no shell twin, so add the case inline:

- seed `engine.mode=docker`, and put a **passthrough** `createFakeDockerBin({ mode: 'passthrough' })` first on `PATH`;
- assert that stdout and the exit code match the native run, and that stderr is empty (no fallback warning);
- assert from `fakeDocker.readCalls()` that exactly one `run` call happened. Its argv mounts the global config dir read-only, and its env forwards `CLAUDE_CONFIG_DIR`. Reuse the helpers in `core/spec/support/factories/engineDispatchDockerSetup.js` (`runCalls`, `splitRunArgv`, `fixedRunFlags`) where they fit.

Keep one fallback case: with the fake's `image inspect` scripted as `DOCKER_PRESETS.daemonDown`, the shim falls back to native on the host and prints the `Docker is unavailable (daemon not reachable)` warning (`dockerUnavailableWarning`).

Update the spec's header comment, which describes the old not-docker-ready behavior.

Also add the optional `docker` callback to `core/spec/support/sharedExamples/engineDispatchRouting.js`'s `itRoutesEngineDispatch`, as testing.md specifies. When given, it adds a third `it` that seeds `engine.mode=docker`, puts a passthrough fake `docker` first on `PATH`, and calls the callback with the result and the fake's calls. Dual entrypoints flipped later will use it. Existing callers don't pass it, so their behavior doesn't change.

## Files to Change

- `core/spec/bin/arcanumCheckConfig_spec.js`: docker-ready routing case, fallback case, header comment.
- `core/spec/support/sharedExamples/engineDispatchRouting.js`: optional `docker` callback.

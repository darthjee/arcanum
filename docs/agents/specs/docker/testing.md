# Docker Engine: Testing

Part of the [Docker Engine spec](../docker.md) (epic #724). Written in #727, implemented in #729.

This part defines how `engine.mode=docker` is tested: what CI covers without a Docker daemon, what only runs locally against a real container, and what evidence a [checklist](checklist.md) row needs before it goes ✅. The behavior under test is in [dispatch.md](dispatch.md).

## Layers

| Layer | What it proves | Where it runs | Needs Docker |
| --- | --- | --- | --- |
| [Routing specs](#routing-specs-ci) | dispatch picks the right engine, builds the right `docker run` argv, and passes exit codes and streams through | existing CircleCI `test` job, and `make core-test` | no, `docker` is faked |
| [Parity specs](#parity-specs-local-only) | a real container produces the same output, exit code and files as native on the host | locally, `make docker-parity` | yes |
| Manual checks | macOS Docker Desktop specifics: file-sharing ownership, the SSH agent proxy, per-call cost | by the PR author, noted in the PR | yes |

## Routing specs (CI)

Jasmine specs under `core/spec/bin/`, picked up by the existing `bin/**/*_spec.js` glob in `core/spec/support/jasmine.json`, so they run in the existing CircleCI `test` job (`yarn test`) with no config change.

### Fake `docker`

A new helper, `core/spec/support/utils/fakeDockerBin.js`, built like `fakeGhBin.js`: it writes an executable `docker` into a temp dir that the spec puts first on `PATH`. Its behavior is baked into the bin dir at build time, so it doesn't depend on env surviving to the call. It:

- appends every invocation's argv (one JSON array per line) and the values of the `-e` names it was given to a log file the spec reads back;
- answers `image inspect` with a configurable exit code and stderr (image present, image missing, daemon down);
- answers `pull` and `build` with a configurable exit code;
- answers `run` in one of two modes:
  - **scripted:** print configured stdout/stderr and exit with a configured code (any code, including 3, 4 and 125–127);
  - **passthrough:** run `core/bin/arcanum` on the host with the argv after the image reference and only the `-e` env, then exit with its code. That simulates the container closely enough to compare outputs with the native path, without a daemon.

"Docker unavailable" by missing binary is a `PATH` with no `docker` on it.

### Dispatch-level specs

`core/spec/bin/engineDispatchDocker_spec.js` drives `engine_dispatch` itself through a `bash -c` wrapper that sources `arcanum/_lib/engine_dispatch.sh`, points `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` at a fixture map, and calls `engine_dispatch` with a fixture command. The status file never needs an env override in production code: only the sourced variable changes. Fixture commands reuse `dispatch-fixture-crash` and `auto-fix-all-config-get`, the anchors `arcanum/_lib/test_engine_dispatch.sh` already uses, so the shell and native sides exist.

Cases, each asserting stdout, stderr (including the exact warning line) and exit code, plus the fake's argv log:

- **Resolution table:** every row of [dispatch.md](dispatch.md#resolution-order): `ARCANUM_IN_DOCKER=1` (no `docker` call at all), `host-only`, `native`, `shell`, Docker unavailable (no binary, `image inspect` failing on the daemon, image missing with pull and build failing), and `docker`.
- **Other modes:** `engine.mode=shell` and `native` against each of the four status values, per the mode table.
- **Reading rule:** legacy `true`/`false`, missing key, unknown value, missing file and malformed file, for a dual entrypoint and for a `--native-only` call.
- **Native-only:** a `--native-only` call under docker follows the table, with no hard error and never the shell script.
- **argv:** `--rm`, `-i`, no `-t`, no `--name`, `--init`, the label, `--user <uid>:<gid>`, `--read-only` and the tmpfs, the capability flags, `-w` and the repo mount. Also the git common dir mount for a worktree fixture (`createGitFixtureRepo` plus `git worktree add`), the log directory mount when `engine.log.location` is set, every `--needs` tag's mounts and env, `-e` names with no `=value`, `HOME` and `PATH` never forwarded, and the image tag.
- **Path arguments:** `--path-arg` with a file outside the repo (`ro` mounts the file, `rw` the parent), inside the repo (no mount), a relative path, an absent argument, an empty string and a missing file.
- **Exit codes and streams (passthrough and scripted):** 0, 1, 3, 4 and a signal code pass through. stdout and stderr stay separate. 125, 126 and 127 from `run` fall back to native on the host exactly once, with Docker's stderr and then the warning.
- **Image acquisition:** image missing → `pull`. Pull failing → `build` with the `runtime` target and version build arg. A dev install → `local-<sha>` tag with no pull. `Info:` lines go to stderr only.
- **Nested guard:** with `ARCANUM_IN_DOCKER=1`, the native call forwards the container infrastructure env (each only when set), and without it forwards nothing extra.

### Shim-level specs

`core/spec/support/sharedExamples/engineDispatchRouting.js`'s `itRoutesEngineDispatch` gains an optional `docker` assertion. When given, it adds a third `it` that seeds `engine.mode=docker` and puts a passthrough fake `docker` first on `PATH`. The pilot entrypoint (#729), and every command flipped to `"docker"` after it, passes a `docker` callback in its existing routing spec. That proves its real shim reaches `docker run` with the mounts and env its checklist row lists, through its own `--needs`/`--path-arg` declarations.

`core/spec/bin/arcanumCheckConfig_spec.js`'s docker case changes from "fails without a fallback" to the native-only rule in [dispatch.md](dispatch.md#native-only-commands).

### Native exit-code contract

A spec on `core/bin/arcanum` asserting that a `DispatchFailure` with an exit code in 125–127 exits `1`, which keeps the [exit-code rule](dispatch.md#exit-codes-and-streams) safe.

`arcanum/_lib/test_engine_dispatch.sh` stays a standalone smoke script, updated for the new reading rule. It is not where docker coverage goes, since CI doesn't run it.

## Parity specs (local only)

Real container against native on the host, for the same command and inputs. For each case:

- stdout is byte-identical, with no path rewriting, since paths are the same inside and out (see [mounts.md](mounts.md#path-identity));
- the exit code is the same;
- the same files are created or changed, with the same content. On Linux, created files are owned by the host uid.

How it runs:

- **Location:** `core/spec/docker/**/*_spec.js`, outside the default `jasmine.json` globs, with its own config `core/spec/support/jasmine-docker.json`. `yarn test` never picks them up.
- **Make target:** `make docker-parity`, next to the `core-*` targets in the root `Makefile`. It builds the `runtime` target as `darthjee/arcanum:local-test` (`docker build -f core/Dockerfile --target runtime …`, see [image.md](image.md#what-the-runtime-target-bakes-in)) and then runs the parity config with node on the **host**, since the specs need the host's Docker CLI. It can't run inside the `core-test` container, which has no Docker. #729 adds the target, the config and the pilot's case.
- **Image under test:** the specs call dispatch through the same `bash -c` wrapper as the dispatch-level specs and set the image tag there (a sourced variable, like the status file, never an env hook in production code), so they never pull a published image.
- **Fixtures:** the existing ones. `createGitFixtureRepo` (with a worktree variant), the per-command parity setups under `core/spec/support/factories/`, and `tempDir.js` for argument paths outside the repo.
- **Credentials:** cases that need `gh` or a git remote are opt-in. They run only when `ARCANUM_DOCKER_PARITY_GH=1` (with a token resolvable on the host and a sandbox repo) or `ARCANUM_DOCKER_PARITY_SSH=1` (with an agent and an ssh remote) is set, and are marked pending otherwise. A fake GitHub API can't reach into the container, so these are the only way to check the gh/ssh wiring for real. Fake `gh` binaries don't help either: the image has its own `gh`.

## Not in CI, and why

- CircleCI's `setup_remote_docker` runs the daemon on a separate remote host. Bind mounts there refer to the remote host's filesystem, not the job's checkout, so the [path-identity](mounts.md#path-identity) mounts parity depends on can't work.
- A machine executor job could run Docker locally, but it was rejected: it is slower and costs more than the Docker executor jobs, and it means a second job definition to maintain for one feature.

The risk this leaves is drift between the `runtime` image and the code, such as a missing tool or a wrong path in the baked install, caught only by whoever runs `make docker-parity`. What mitigates it:

- The `test` and `runtime` targets share the `base` stage (see [image.md](image.md#strategy-one-shared-base-two-targets)), so CI's `yarn test` already runs under the same `jq`, `git` and `gh` pins.
- The routing specs' passthrough mode runs the real native CLI with the exact argv and env the container would get.
- No checklist row goes ✅ without a local parity run (below).

## Ticking a checklist row

A PR that flips a command to `"docker"` and ticks its row ✅ needs, in the same PR:

1. **Routing:** the generic dispatch-level specs pass (no per-command work), and the command's shim-level routing spec has a `docker` callback.
2. **Parity:** a case for the command under `core/spec/docker/`, run locally with `make docker-parity` and reported as passing in the PR description (platform included). A command that can't have one says why in its checklist `notes`: `host-only` (never ticked ✅, status `n/a`), or credentials-only behavior that is covered by an opt-in case the author ran.
3. **Declarations:** the shim's `--needs`/`--path-arg` match the row's `mounts` and `env` columns.
4. **Map:** the command's `arcanum/_lib/migration-status.json` value is `"docker"`, and its checklist `issue` cell names the PR's issue.

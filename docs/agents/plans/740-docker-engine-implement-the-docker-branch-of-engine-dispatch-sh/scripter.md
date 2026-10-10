# Scripter Plan: Docker engine: implement the docker branch of engine_dispatch.sh

Main plan: [plan.md](plan.md)

## Shared contracts

### Files and sourced variables

- New file `arcanum/_lib/engine_dispatch_docker.sh`, sourced by `arcanum/_lib/engine_dispatch.sh` (keeps the shim-facing lib readable; all docker-only helpers are `_engine_dispatch_docker_*` functions there). Specs keep sourcing only `engine_dispatch.sh`.
- Sourced variables specs override in the `bash -c` wrapper (never env hooks in production code), all set in `engine_dispatch.sh` / `engine_dispatch_docker.sh` with these exact names and defaults:
  - `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` (exists today).
  - `_ENGINE_DISPATCH_INSTALL_ROOT`: the arcanum install root (default: two levels up from `arcanum/_lib`). Used for version resolution and as the `docker build` context.
  - `_ENGINE_DISPATCH_DOCKER_IMAGE`: the image ref. Default empty, meaning "resolve from `_ENGINE_DISPATCH_INSTALL_ROOT`" (`darthjee/arcanum:<version>`, or `darthjee/arcanum:local-<short HEAD>` for a git install with no exact tag on HEAD, which skips the pull). When non-empty it is used as-is and is treated as a pullable tag unless it starts with `darthjee/arcanum:local-`.
- Version resolution mirrors `init-claude/scripts/stamp_arcanum_version_shell.sh` / `core/lib/utils/file/InstallVersion.js`: `arcanum.json` `.version` if that file exists, else `git -C <root> describe --tags --exact-match HEAD` if `<root>/.git` is a directory, else `local-$(git -C <root> rev-parse --short HEAD)`.
- Image lock: `${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock`, through `arcanum/_lib/lock.sh` (`LOCK_FILE` + `_acquire_lock`/`_release_lock`). Specs set `XDG_CACHE_HOME` to a temp dir.

### `engine_dispatch` CLI (shim-facing)

`engine_dispatch <repo_path> <command> <shell_script> [--prepend-repo-path] [--native-only] [--needs=<tag>[,<tag>...]]... [--path-arg=<index>:<ro|rw>]... [<env_var_name> ...] -- <args...>`. `--needs`/`--path-arg` are repeatable, single-token, recognized anywhere before `--`, and ignored outside the container path. Unknown `--needs` tags or malformed `--path-arg` values are an error: `Error: engine_dispatch: invalid <flag> '<value>'.` on stderr, return 1.

### Exact stderr lines (each followed by `\n`)

- Row 3: `Warning: '<command>' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host.`
- Row 3b: `Warning: no native implementation of '<command>' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation.`
- Row 4: `Warning: Docker is unavailable (<reason>) — running '<command>' natively on the host. Fix Docker or change engine.mode.` with `<reason>` one of `docker not found`, `daemon not reachable`, `image <ref> unavailable`, `docker run failed with <code>`.
- `Info: pulling <ref> (first docker call for this version)…` and `Info: building <ref>…` (stderr only).

### `docker` subcommands dispatch calls (what the fake must handle)

In order, and only these:

1. `docker image inspect --format '{{.Id}}' <ref>`: exit 0 means present. Non-zero with stderr containing `Cannot connect to the Docker daemon` means reason `daemon not reachable`. Any other non-zero means missing.
2. `docker pull <ref>` (skipped for `local-` refs).
3. `docker build -f <install_root>/core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=<version> -t <ref> <install_root>`.
4. `docker run <flags...> <ref> <command> [<repo_path>] <args...>`, with the flags from `docs/agents/specs/docker/dispatch.md` → "`docker run` invocation shape" in this order: `--rm -i --init --label arcanum.dispatch=1 --user <uid>:<gid> --read-only --tmpfs /tmp:rw,exec,mode=1777 --cap-drop ALL --security-opt no-new-privileges -w <repo> -v <repo>:<repo>`, then optional `-v` mounts (common dir, log dir, `--needs`, `--path-arg`), then `-e NAME` entries (name only, never `NAME=value`), then the image. The arguments after the image are exactly what `_engine_dispatch_run_native` passes to `core/bin/arcanum` (command, optional repo path, args; relative out-of-repo path args rewritten to absolute).

### `core/bin/arcanum` exit-code rule

A `DispatchFailure` whose `exitCode` is 125, 126 or 127 exits 1. Nothing else changes.

## Steps

- [01 — Flags, resolution table, native-only and nested guard](scripter/01-flags-resolution-and-nested-guard.md)
- [02 — Availability check and image acquisition](scripter/02-availability-and-image-acquisition.md)
- [03 — docker run argv, mounts, env and exit codes](scripter/03-docker-run-argv-and-exit-codes.md)
- [04 — Smoke script and docs](scripter/04-smoke-script-and-docs.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`, `yarn test`). The node specs exercise this lib, so run them after node's work lands.
- `bash arcanum/_lib/test_engine_dispatch.sh` locally (not in CI).

## Notes

- Bash 3.2 compatible throughout, with the same empty-array guards as today.
- Keep `engine.mode=shell` and `native` behavior byte-identical to today; only the docker branch and the native-only docker case change.
- `lock.sh` sleeps 1s per acquisition. Only take the image lock when a pull or build is actually needed, never on the inspect-hit path.
- Known limitations (commit signing, hooks, included git config) are out of scope; nothing here enforces them.
- Step 04's doc edits are listed as architect-owned in the issue; scripter makes them here because they describe this lib. The architect reviews them.

# Docker Engine: Dispatch

Part of the [Docker Engine spec](../docker.md) (epic #724). Written in #727, implemented in #729.

This part defines the docker branch of `arcanum/_lib/engine_dispatch.sh`: when a call goes to a container, how the `docker run` command is assembled from [image.md](image.md), [mounts.md](mounts.md) and [environment.md](environment.md), and what happens when Docker is missing or fails. How it is tested is in [testing.md](testing.md).

## Resolution order

Under `engine.mode=docker`, `engine_dispatch` evaluates this table top-down for every call and takes the first matching row:

| # | Condition | Runs | stderr warning |
| --- | --- | --- | --- |
| 1 | `ARCANUM_IN_DOCKER=1` is set (a [nested call](#nested-call-guard) inside the container) | native, directly, in the current container | none |
| 2 | the command's status is `host-only` | native on the host | none (expected, not a fallback) |
| 3 | the command's status is `native` (not docker-ready yet) | native on the host | `Warning: '<command>' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host.` |
| 3b | the command's status is `shell` (no native implementation) | `<shell_script>` on the host | `Warning: no native implementation of '<command>' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation.` (today's wording) |
| 4 | Docker is [unavailable](#docker-availability-check) | native on the host | `Warning: Docker is unavailable (<reason>) — running '<command>' natively on the host. Fix Docker or change engine.mode.` |
| 5 | otherwise (status `docker`, Docker available) | [`docker run`](#docker-run-invocation-shape) | none |

Every fallback prints exactly one warning line on stderr and leaves stdout and the exit code exactly as the implementation that ran produced them. A Docker failure discovered after `docker run` started is handled in [Exit codes and streams](#exit-codes-and-streams), and falls back to row 4.

The other modes read the same status values but ignore the docker distinction:

| `engine.mode` | `shell` | `native` | `docker` | `host-only` |
| --- | --- | --- | --- | --- |
| `shell` (default) | shell | shell | shell | shell |
| `native` | shell, with today's warning | native | native | native |
| `docker` | shell, with the row-3b warning | native on the host, row-3 warning | container | native on the host |

So `native` keeps meaning "has a native implementation": any value other than `shell`. Native-only commands (`--native-only`) never run a shell script: under `shell` and `native` they run native, as today, and under `docker` they follow the table above (see [Native-only commands](#native-only-commands)).

## Docker-readiness source of truth

`arcanum/_lib/migration-status.json` stays the single map dispatch reads. Its values change from booleans to a string enum:

| Value | Meaning | Replaces |
| --- | --- | --- |
| `"shell"` | no native implementation yet; dual entrypoints only | `false` |
| `"native"` | a native implementation exists, but the command is not docker-ready | `true` |
| `"docker"` | native exists and runs in the container; the checklist row is ✅ | — |
| `"host-only"` | native exists, and the command never runs in the container (reason in the checklist `notes`) | — |

A string enum and not an object: the map only answers "which engine may run this", one value per command. Everything else a container call needs per command (credentials, extra mounts, path arguments) is declared by the shim next to its env allowlist (see [Per-command declarations](#per-command-declarations)), which is where that knowledge already lives today.

### Native-only commands are listed

Native-only commands get entries too, with `"native"`, `"docker"` or `"host-only"`, never `"shell"`. Their `--native-only` flag on the shim still says they have no shell twin. The map lists the dispatch commands, as the [checklist](checklist.md) does.

### Migration of existing values

Issue #729 rewrites the file in one commit:

- every `true` becomes `"native"` (all 79 keys today);
- `arcanum-update-run-update-apply`, `arcanum-update-run-update-check` and `auto-fix-issue-run-checks` become `"host-only"`. For `auto-fix-issue-run-checks` this is the final call the checklist deferred to #727: it runs the target project's own check script, whose toolchain the image doesn't have;
- the native-only commands (`arcanum-check-config`, `arcanum-create-issue-start`, `arcanum-create-issue-publish`, `init-claude-set-next-step-auto`) are added as `"native"`;
- the pilot entrypoint #729 makes docker-ready becomes `"docker"`.

### Reading rule

`_engine_dispatch_status <command> <native_only>` replaces `_engine_dispatch_native_available`. It prints one of `shell`, `native`, `docker`, `host-only` and always exits 0:

| Map state | Dual entrypoint | Native-only command |
| --- | --- | --- |
| a known string value | that value | that value (`"shell"` reads as `native`) |
| legacy `true` / `false` | `native` / `shell` | `native` |
| missing key, unknown value, missing or malformed file | `shell` | `native` |

The fallbacks are the safest value that can still run: `shell` for a dual entrypoint, as today, and `native` for a native-only command, which has nothing else. Neither can ever start a container. Tolerating legacy booleans keeps a half-updated install working during the #729 rollout.

### Other readers #729 updates

- `arcanum/_lib/engine_dispatch.sh` (the function above) and `arcanum/_lib/test_engine_dispatch.sh`.
- `scripts/generate_entrypoint_migration_status.sh`, which renders the boolean as `Migrated`, plus a regenerated `docs/agents/architecture/entrypoint-migration-status.md`. Its "native-only commands are not tracked" note goes away.
- Docs that describe the map as booleans or say native-only commands are not listed: `docs/agents/architecture/script-engine.md`, `docs/agents/specs/shell-engine-removal.md` (its precondition becomes "no entry is `shell`"), and the `node`/`scripter` agent definitions under `.claude/agents/`.

### The checklist stays hand-maintained

The map is what dispatch reads, and the checklist is what humans read. A PR that ticks a checklist row ✅ flips that command's value to `"docker"` in the same PR, and the reverse. Neither is generated from the other.

## Per-command declarations

The shim already passes `engine_dispatch` a per-command env allowlist and flags in the segment before `--`. Docker adds two more flags to that segment. Both use the single-token `--flag=value` form, so the parser never has to look ahead, and neither can collide with an env var name (those never contain `-`).

| Flag | Repeatable | Values | Drives |
| --- | --- | --- | --- |
| `--needs=<tag>[,<tag>...]` | yes | `global-config`, `gitconfig`, `gh`, `remote` | the checklist `mounts` and `env` columns |
| `--path-arg=<index>:<ro\|rw>` | yes | 1-based index into `<args...>` | `args:ro` / `args:rw` mounts |

`--needs` maps to the checklist shorthands:

| Tag | Mounts | Env |
| --- | --- | --- |
| `global-config` | `$CLAUDE_CONFIG_DIR/arcanum-config.json`, `ro`, if it exists ([mounts.md](mounts.md#global-arcanum-config)) | `-e CLAUDE_CONFIG_DIR=<host path>` |
| `gitconfig` | the global git config file, `ro` ([mounts.md](mounts.md#git-and-ssh-config)) | `-e GIT_CONFIG_GLOBAL=<host path>` |
| `gh` | — | `-e GH_TOKEN` (or `GH_HOST` + `GH_ENTERPRISE_TOKEN`), resolved on the host ([environment.md](environment.md#gh-credentials)) |
| `remote` | agent socket and `known_hosts:ro` for an ssh remote ([environment.md](environment.md#git-remote-access)) | `SSH_AUTH_SOCK` + `GIT_SSH_COMMAND`, or `GH_TOKEN` + credential-helper `GIT_CONFIG_*` for https |

Both flags are ignored outside the container path, so adding them to a shim changes nothing under `shell` or `native`. A shim adds them in the same PR that flips its command to `"docker"`, and its checklist row must match them. `host-only` commands declare neither.

### Argument path declaration

`--path-arg=<index>:<mode>` marks `<args...>[index]` (1-based, counting only the args after `--`, never the repo path `--prepend-repo-path` adds) as a file path. For each declared index present on this call, dispatch resolves the mount on the host:

| Case | Rule |
| --- | --- |
| argument absent on this call (fewer args than `index`) | ignored |
| empty string | ignored |
| relative path | resolved against the shim's `$PWD`. If it lands outside the repo, the container gets the absolute path in its argv instead of the relative one, since the container's working directory is the repo |
| inside `$REPO_PATH` | nothing extra, the repo is already mounted |
| outside the repo, `ro` | the file itself, at the same path, `:ro`. Missing file: not mounted, and the command fails in the container the way it would natively |
| outside the repo, `rw` | the parent directory, at the same path, `rw`, since the file may not exist yet. Missing parent: not mounted, same failure as natively |

Mount sources that are the same path or nested in one another are collapsed into one `-v` (an `rw` parent wins over an `ro` file under it). Only positional path arguments exist today (`github-issue-create <repo_path> <title> <file>`, `permission-grant-add <anchor> add <file> <pattern>`, …). A future option-style path (`--body-file <path>`) gets a sibling flag when it appears, not before.

## `docker run` invocation shape

A full call for `github-issue-create` (`--needs=global-config,gitconfig,gh --path-arg=3:ro`, a worktree repo, a body file in the scratchpad). It is annotated, not runnable as is: a comment can't follow a line continuation.

```bash
docker run \
  --rm -i \                                        # always; never -t (see TTY)
  --init \                                         # signal forwarding, see Concurrency
  --label arcanum.dispatch=1 \                     # find stray containers, see Concurrency
  --user "$(id -u):$(id -g)" \                     # mounts.md#file-ownership
  --read-only --tmpfs /tmp:rw,exec,mode=1777 \     # image.md: HOME=/tmp/arcanum-home, scratch space
  --cap-drop ALL --security-opt no-new-privileges \
  -w "$REPO_PATH" \
  -v "$REPO_PATH:$REPO_PATH" \                     # always
  -v "$COMMON_DIR:$COMMON_DIR" \                   # worktrees only
  -v "$LOG_DIR:$LOG_DIR" \                         # when engine.log.location is set, outside the repo
  -v "$CLAUDE_CONFIG_DIR/arcanum-config.json:$CLAUDE_CONFIG_DIR/arcanum-config.json:ro" \  # --needs=global-config
  -v "$GIT_GLOBAL:$GIT_GLOBAL:ro" \                # --needs=gitconfig
  -v "$BODY_FILE:$BODY_FILE:ro" \                  # --path-arg=3:ro
  -e ARCANUM_IN_DOCKER=1 -e ARCANUM_REPO_PATH \    # fixed env
  -e GIT_CONFIG_COUNT -e GIT_CONFIG_KEY_0 -e GIT_CONFIG_VALUE_0 -e GIT_CONFIG_KEY_1 -e GIT_CONFIG_VALUE_1 \
  -e CLAUDE_CONFIG_DIR -e GIT_CONFIG_GLOBAL -e GH_TOKEN \   # from --needs
  -e <each allowlisted name that is set, except HOME and PATH> \
  darthjee/arcanum:<version> \                     # image.md#distribution-and-versioning
  github-issue-create "$REPO_PATH" "$TITLE" "$BODY_FILE"
```

Every `-e` carries a name only. Dispatch exports the values in its own process first, so no value is ever in argv (see [environment.md](environment.md#allowlist-mapping)). The image entrypoint `exec`s `/opt/arcanum/core/bin/arcanum`, so the arguments after the image are exactly what `_engine_dispatch_run_native` passes natively: the command, the repo path when `--prepend-repo-path` is given, then `<args...>`.

Where each piece comes from:

- **Fixed for every call:** `--rm -i --init --label`, `--user`, `--read-only`/`--tmpfs`, the capability flags, `-w`, the repo mount, the fixed env.
- **From the repo and config:** the git common dir (worktrees), the log directory, the `safe.directory` entries.
- **From the shim's declarations:** the `--needs` mounts and env, the `--path-arg` mounts, the env allowlist.
- **From the install:** the image tag, resolved once per call as in [image.md](image.md#distribution-and-versioning). Like the status file path, the resolved reference sits in a variable of the sourced library, which the parity specs override (see [testing.md](testing.md#parity-specs-local-only)).

The root filesystem is read-only: everything the command may write is a mount or the tmpfs `/tmp`, which also holds the synthetic `HOME`. No `--network` flag: the default bridge network is needed for `gh` and git remotes.

### Per-call `docker run`, and when to revisit it

Per-call `docker run` is the default. A long-lived container with `docker exec` would save startup time, but its mounts and env are fixed when it is created, while every call here needs its own `--path-arg` mounts, credentials and allowlist. It would also share `/tmp` and `HOME` between calls and need a lifecycle owner. So it is only worth that cost if startup is clearly too slow.

Issue #729 measures it with the pilot entrypoint and records the numbers in its PR:

- **Commands:** `issue-state get` (local file, no credentials), `resolve-plan-paths` (filesystem only), `auto-fix-all-config-get` (config chain) and `github-issue-info` (gh plus network, measured with a fake API or against a sandbox repo, so only the overhead is compared). The last three need not be docker-ready to be benchmarked: #729 runs them through a local build of the `runtime` image directly.
- **Platforms:** Linux (native Docker Engine) and macOS (Docker Desktop, virtiofs).
- **Runs:** 20 per command and platform, warm (daemon up, image local) and once cold (first call after a daemon restart). Report median and p95 wall time for native on the host and for `docker run`, and the overhead between them.
- **Threshold:** per-call `docker run` stays if the warm median overhead is at most 1s on Linux (the index's target) and at most 2s on macOS. Above either, #729 still ships per-call, and a new sub-issue of #724 designs the `docker exec` alternative. The pilot is not blocked on it.

## Docker availability check

Run once per call, before row 5 of the resolution table, in order. The first failure is the `<reason>` in the row-4 warning:

1. `command -v docker`: the binary is on `PATH`. Reason `docker not found`. Free.
2. `docker image inspect --format '{{.Id}}' <ref>`: one call that covers both the daemon and the image. A daemon error (`Cannot connect to the Docker daemon`) gives reason `daemon not reachable`. Typically 30–100ms on Linux, more on Docker Desktop.
3. Image missing: pull, then local build, exactly as [image.md](image.md#distribution-and-versioning) says. Dispatch prints `Info: pulling darthjee/arcanum:<version> (first docker call for this version)…` (or `building`) on stderr, never on stdout. The pull or build runs under a lock in the user's cache dir (`${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock`), so concurrent first calls don't race. Both failing gives reason `image darthjee/arcanum:<version> unavailable`.

There is no cross-call cache: every shim call is its own process, and a cache file could go stale (daemon stopped, image pruned). A process that dispatches several times may cache the result in memory. Step 2 is cheap enough to repeat, and the benchmark above measures it as part of the overhead.

## Native-only commands

Today's hard error (`engine.mode=docker is not implemented yet for native-only command …`) goes away. Under docker, a native-only command follows the same [resolution order](#resolution-order) using its `migration-status.json` entry, minus row 3b: not docker-ready means native on the host, Docker unavailable means native on the host. `core/spec/bin/arcanumCheckConfig_spec.js`'s "fails without a fallback when engine.mode is docker" case changes accordingly in #729.

## Exit codes and streams

- **Exit code:** `engine_dispatch` returns the `docker run` exit code, which is the container command's own exit code, unchanged. That includes `3` and `4` (`FALLBACK=chat`) and 128+n for a signal.
- **Streams:** no `-t`, so stdout and stderr stay separate streams, byte for byte, with no CR conversion. `-i` attaches stdin, for the commands that read it.
- **Docker's own failures:** `docker run` itself exits `125` when the daemon can't create or start the container, `126` when the entrypoint can't be invoked, and `127` when it isn't found. In all three, no arcanum code ran. Dispatch therefore treats `125`, `126` and `127` from `docker run` as "Docker unavailable": it falls back to native on the host with the row-4 warning (reason `docker run failed with <code>`), and Docker's own stderr message is passed through above the warning. That fallback runs the command exactly once, because the container attempt never started it.

This only works because the native CLI never exits with `125`–`127` itself. Today `core/bin/arcanum` and the commands under `core/lib/` use `0`–`4`, `130` and `error.exitCode ?? 1`. #729 makes that a stated contract in `core/bin/arcanum` (a `DispatchFailure` exit code in `125`–`127` is mapped to `1`) and covers it with a spec. A command whose exit code passes through a child's (none today; `auto-fix-issue-run-checks` is `host-only`) must stay `host-only` or map these codes too.

## Nested-call guard

- **Where:** the very first thing in `engine_dispatch`, after parsing its own flags and before `config_chain_read`. If `ARCANUM_IN_DOCKER=1`, it runs the native implementation and returns. It never reads `engine.mode`, never runs the availability check, and never starts a container.
- **Status inside the container:** the image always has `core/bin/arcanum`, so every command with any status other than `shell` runs native there, including `native` (not docker-ready) and native-only commands. `host-only` commands run native in the container too, against the image's copy. No native command calls a `host-only` shim today, and one that ever does must be `host-only` itself.
- **No native implementation:** a nested command whose status is `shell` runs its shell script inside the container. The image has `bash`, `jq`, `git` and `gh` (see [image.md](image.md#strategy-one-shared-base-two-targets)), so this works. No such command is nested today.
- **Env:** inside the container, `_engine_dispatch_run_native` forwards the [container infrastructure env](environment.md#container-infrastructure-env) on top of the command's own allowlist, each only when set. Natively, on the host, it forwards nothing extra, as today.

## TTY

Decided: no TTY in the container, ever. Dispatch never passes `-t`, and the container has no `/dev/tty`.

Today two dispatched commands open `/dev/tty` through `core/lib/utils/io/TtyPrompt.js`: `arcanum-create-issue-start` and `arcanum-create-issue-publish` (both native-only). Under docker they can't open it, so they always take their exit-4 `FALLBACK=chat` path, and `arcanum-create-issue` already handles that with `AskUserQuestion`. The user-visible change: no terminal prompt under docker, the chat fallback every time. Nothing else changes. The exit code and the `FALLBACK=chat`/`DRAFT=` lines pass through as in [Exit codes and streams](#exit-codes-and-streams).

Non-dispatched TTY scripts, such as `next_step_prompt.sh`, never reach dispatch and stay with #733.

## Concurrency

- **No fixed names:** dispatch never passes `--name`, so concurrent calls (parallel agents, `auto-fix-all` loops) can't collide. Docker assigns a random name.
- **Cleanup:** `--rm` on every call removes the container when it exits.
- **Interrupts:** without `-t`, the `docker run` client proxies the signals it receives to the container (`--sig-proxy`, on by default), and `--init` runs a minimal init as PID 1, which forwards them to the native process and reaps children. Ctrl-C or a killed skill therefore stops the container, and `--rm` removes it.
- **Hard kills:** if the `docker run` client itself is killed with `SIGKILL`, it can't forward anything and the container keeps running until its command finishes, then `--rm` removes it. The `arcanum.dispatch=1` label lets a user list or remove such containers (`docker ps --filter label=arcanum.dispatch=1`). There is no automatic reaper.
- **Locks:** a host process and a container process share the same lock files through the repo mount. See [mounts.md](mounts.md#shared-state-and-locks).

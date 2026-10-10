# Issue: Docker engine: implement the docker branch of engine_dispatch.sh

## Description

Part of #729 (epic #724). Second of three sub-issues: #739 (status enum, merged) → **#740** → #741 (parity harness, `arcanum-check-config` pilot, benchmark). Implements the real docker branch of `arcanum/_lib/engine_dispatch.sh` per `docs/agents/specs/docker/dispatch.md`, `mounts.md`, `environment.md`, `image.md` and `testing.md`, with CI coverage driven by a fake `docker` binary (no daemon). No command is flipped to `"docker"` here, so production calls under `engine.mode=docker` still resolve to native on the host (row 3); only specs reach `docker run`.

## Problem

Under `engine.mode=docker`, `engine_dispatch` today warns and falls back to the shell implementation for dual entrypoints, and hard-errors (`Error: engine.mode=docker is not implemented yet ...`, exit 1) for `--native-only` commands. `_engine_dispatch_status` already returns the four-value enum (#739), but nothing acts on `docker`/`host-only` under docker mode, and there is no container execution path.

## Expected Behavior

- Under `engine.mode=docker`, every call follows the resolution table in `dispatch.md` (rows 1, 2, 3, 3b, 4, 5), printing exactly one stderr warning per fallback and leaving stdout and the exit code exactly as the implementation that ran produced them.
- `--native-only` commands under docker follow the same table minus row 3b: no hard error, never a shell script.
- `engine.mode=shell` and `native` behave exactly as the spec's mode table says (unchanged from today).
- A command with status `docker` and Docker available runs in `docker run` with the spec's argv, mounts and env.

## Solution

### `arcanum/_lib/engine_dispatch.sh` (scripter)

- **Resolution order** under `engine.mode=docker`: nested guard (`ARCANUM_IN_DOCKER=1`, checked first) → `host-only` → `native` (row-3 warning) → `shell` (row-3b warning, today's wording) → Docker unavailable (row-4 warning, native on host) → `docker run`. Exactly one stderr warning per fallback.
- **Native-only commands**: replace today's hard error with the same table, minus row 3b.
- **Per-command flags** `--needs=<tag>[,...]` (`global-config`, `gitconfig`, `gh`, `remote`) and `--path-arg=<index>:<ro|rw>`, parsed in the same pre-`--` segment as `--prepend-repo-path`/`--native-only`, and ignored outside the container path. Path-arg resolution follows the spec's case table, including collapsing nested mounts.
- **Availability check**: `command -v docker`, then `docker image inspect`, then pull, then local build (`--target runtime`, version build arg) under a lock in `${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock`. `Info:` lines go to stderr only. The image tag is `darthjee/arcanum:<version>`, or `local-<short HEAD>` for dev installs (no pull). The image ref is a sourced variable that specs override, like `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` already is.
- **`docker run` argv** exactly as the spec shapes it: `--rm -i --init`, the `arcanum.dispatch=1` label, `--user uid:gid`, `--read-only` + tmpfs `/tmp`, `--cap-drop ALL --security-opt no-new-privileges`, `-w` + repo mount, the git common dir for worktrees, the log dir, `--needs`/`--path-arg` mounts, name-only `-e` (fixed env, credential-helper `GIT_CONFIG_*`, `--needs` env, allowlist minus `HOME`/`PATH`). Never `-t` or `--name`.
- **Exit codes and streams**: pass through unchanged. `125`/`126`/`127` from `docker run` fall back to native on the host exactly once, with Docker's stderr above the row-4 warning.
- **Nested guard env**: inside the container, `_engine_dispatch_run_native` forwards the container infrastructure env, each var only when set.
- Update the header doc comment of `engine_dispatch` to describe the new docker resolution and flags (it still says docker is "out of scope for now (#192)").

### `core/` (node)

- **`core/bin/arcanum` exit-code contract**: a `DispatchFailure` with exit code 125–127 maps to 1, covered by a spec.
- **`core/spec/support/utils/fakeDockerBin.js`**: fake `docker` with scripted and passthrough modes, logging its argv.
- **Extend the existing `core/spec/bin/engineDispatchDocker_spec.js`** (created by #739 for the reading rule and the shell/native mode table) with every remaining case in `testing.md` → "Dispatch-level specs": resolution table, native-only, argv, path arguments, exit codes and streams, image acquisition, nested guard.
- **`arcanumCheckConfig_spec.js`**: its docker case changes from "fails without a fallback" to the native-only rule.

### Out of scope

- Flipping any command to `"docker"`, the parity harness, `make docker-parity`, the pilot and the benchmark: #741.
- The optional `docker` assertion on `itRoutesEngineDispatch` (`core/spec/support/sharedExamples/engineDispatchRouting.js`): #741, where the pilot is its first caller.
- **Known limitations** (commit signing, git hooks, included git config): not decided here. Each command records its own call when it is flipped in #730.

### Dev-image rebuild (architect)

Docs only, no new code: in `docs/agents/specs/docker/image.md`, replace "How a contributor forces a rebuild is #729's call" with guidance to run `docker rmi darthjee/arcanum:local-<short HEAD>`; the next docker dispatch rebuilds it. Note that uncommitted changes never change the tag, so a contributor testing local edits must remove the image first.

## Owner

scripter (`engine_dispatch.sh`), node (`core/bin/arcanum`, fake docker helper, core specs), architect (`image.md` rebuild guidance).

## Benefits

- The docker execution path exists and is fully covered in CI without a Docker daemon, so #741 only has to flip the pilot and add local parity.
- `--native-only` commands stop hard-erroring under `engine.mode=docker`.

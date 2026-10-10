# Flags, resolution table, native-only and nested guard

Create `arcanum/_lib/engine_dispatch_docker.sh` (sourced from `engine_dispatch.sh` right after `config_chain.sh`) and restructure `engine_dispatch`:

- Parse `--needs=<tags>` (repeatable, comma-separated, tags limited to `global-config`, `gitconfig`, `gh`, `remote`) and `--path-arg=<index>:<ro|rw>` (repeatable, 1-based positive index) in the pre-`--` loop, next to `--prepend-repo-path`/`--native-only`. Invalid values print `Error: engine_dispatch: invalid <flag> '<value>'.` and return 1.
- **Nested guard first**, right after flag parsing and before `config_chain_read`: if `ARCANUM_IN_DOCKER=1`, run `_engine_dispatch_status <command> <native_only>`. Status `shell` (dual only) runs `<shell_script>`; anything else runs `_engine_dispatch_run_native`. No `engine.mode` read, no docker call, no warning.
- `_engine_dispatch_run_native`: when `ARCANUM_IN_DOCKER=1`, also forward the container infrastructure env (`ARCANUM_IN_DOCKER`, `HOME`, `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_COUNT` and every `GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` for n < count, `GIT_SSH_COMMAND`, `SSH_AUTH_SOCK`, `GH_TOKEN`, `GH_HOST`, `GH_ENTERPRISE_TOKEN`, `LD_PRELOAD`, `NSS_WRAPPER_PASSWD`, `NSS_WRAPPER_GROUP`), each only when set. On the host it forwards nothing extra.
- Under `engine.mode=docker`, for dual and native-only calls alike, evaluate the table: `host-only` → native on host, no warning; `native` → row-3 warning + native on host; `shell` (dual only; native-only can never read `shell`) → row-3b warning + `<shell_script>`; otherwise (`docker`) → the availability check (step 02); unavailable → row-4 warning + native on host; available → `docker run` (step 03).
- Remove the native-only hard error. `shell`/`native` modes stay exactly as today (native-only still runs native there without consulting the map).

## Files to Change

- `arcanum/_lib/engine_dispatch_docker.sh` — new: docker helpers, infrastructure-env list.
- `arcanum/_lib/engine_dispatch.sh` — source the new file, flag parsing, nested guard, docker resolution table, native-only docker path, `_engine_dispatch_run_native` infra env, updated header comment.

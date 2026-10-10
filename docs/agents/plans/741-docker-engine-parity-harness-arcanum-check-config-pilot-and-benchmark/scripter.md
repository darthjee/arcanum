# Scripter Plan: Docker engine: parity harness, arcanum-check-config pilot and benchmark

Main plan: [plan.md](plan.md)

## Shared contracts

- New shim call: `engine_dispatch "$REPO_PATH" arcanum-check-config "" --native-only --needs=global-config HOME CLAUDE_CONFIG_DIR -- "$REPO_PATH" "$KEY"`.
- `arcanum/_lib/migration-status.json`: `"arcanum-check-config": "docker"`. `node` updates `core/spec/bin/arcanumCheckConfig_spec.js` in the same PR, because its current docker case expects the "not docker-ready yet" warning.

## Implementation Steps

### Step 1 — Declare the pilot shim's needs and refresh its comment

In `arcanum-check-config/scripts/check_config.sh`, add `--needs=global-config` to the `engine_dispatch` call, after `--native-only` and before the env names. Keep `HOME CLAUDE_CONFIG_DIR` in the allowlist, since the native path on the host still needs them.

Rewrite the header comment's native-only paragraph. It currently says "except engine.mode=docker, which errors out", which has been stale since #740. It should say:
- under `engine.mode=docker` the command runs in the container, now that its status is `"docker"`;
- `--needs=global-config` mounts the global config read-only and forwards `CLAUDE_CONFIG_DIR`;
- docker being unavailable falls back to native on the host with a warning, per `docs/agents/specs/docker/dispatch.md`.

Also update the "Output and exit code" line, which still mentions "engine_dispatch's docker error".

### Step 2 — Flip the pilot to docker

In `arcanum/_lib/migration-status.json`, change `"arcanum-check-config": "native"` to `"docker"`. Check whether `arcanum/_lib/test_engine_dispatch.sh` or `scripts/generate_entrypoint_migration_status.sh` depends on that key's value, and update them if so. Both read the map, but neither is expected to key on this command.

## Files to Change

- `arcanum-check-config/scripts/check_config.sh`: add `--needs=global-config`; update the header comment.
- `arcanum/_lib/migration-status.json`: `arcanum-check-config` set to `"docker"`.

## Notes

- Don't change the checklist row; the `architect` does that.
- Run `shellcheck` on the shim.

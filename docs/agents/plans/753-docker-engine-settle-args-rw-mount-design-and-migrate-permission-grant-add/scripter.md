# Scripter Plan: Docker engine: settle args:rw mount design and migrate permission-grant-add

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produce** the `rw-mkdir` `--path-arg` mode in `arcanum/_lib/engine_dispatch_docker.sh`, exactly as specified in [plan.md](plan.md#shared-contracts). The validation regex is `^[1-9][0-9]*:(ro|rw|rw-mkdir)$`. A missing out-of-repo parent gets `mkdir -p` on the host, then the mount. If the `mkdir` fails, the mount is skipped. It collapses as `rw` and emits `-v src:src` (no `:ro`).
- **Produce** the declarations `permission-grant-add` → `--path-arg=2:rw-mkdir` and `write-label-config-*` → `--path-arg=1:rw-mkdir`.
- **Produce** `"permission-grant-add": "docker"` in `arcanum/_lib/migration-status.json`.
- node's specs rely on all three.

## Implementation Steps

### Step 1 — rw-mkdir mode in engine_dispatch

- `_engine_dispatch_docker_valid_path_arg` (~line 50): accept `rw-mkdir`, and update its header comment.
- The `--path-arg` mount loop (~line 365):
  - Treat `rw-mkdir` like `rw` when picking `src=$(dirname "$abs")`.
  - When `[[ -d "$src" ]]` fails and the mode is `rw-mkdir`, run `mkdir -p "$src" 2>/dev/null` first, and only `continue` if it still isn't a directory.
  - In the collapse logic and the final `-v` emission, normalize `rw-mkdir` to `rw` (e.g. set `mode=rw` after the mkdir handling) so the existing `== "rw"` comparisons hold.
- `arcanum/_lib/engine_dispatch.sh`: update the usage/header comment (~lines 113, 148) to `<ro|rw|rw-mkdir>`.
- `arcanum/_lib/test_engine_dispatch.sh`: no change is required. Add a smoke line only if it already exercises `--path-arg` modes beyond case 12.

### Step 2 — Shims and migration-status flip

- `arcanum/_lib/permission_grant.sh`: add `--path-arg=2:rw-mkdir` to the `engine_dispatch` call in the `add` branch. Update the file's header comment: `<file>` is mounted via `rw-mkdir` when it sits outside the repo, and a relative `<file>` assumes the caller's cwd is `<anchor>` (dispatch resolves relative paths against `$PWD`). Leave the sourced `permission_grant_add` function and the in-process migration path untouched.
- `init-claude/scripts/write_label_config.sh` (~line 113): `--path-arg=1:rw` → `--path-arg=1:rw-mkdir`, and update its comment.
- `arcanum/_lib/migration-status.json`: `"permission-grant-add": "native"` → `"docker"`.

## Files to Change

- `arcanum/_lib/engine_dispatch_docker.sh` — `rw-mkdir` validation and mount handling
- `arcanum/_lib/engine_dispatch.sh` — usage comment
- `arcanum/_lib/permission_grant.sh` — `--path-arg=2:rw-mkdir`, comment
- `init-claude/scripts/write_label_config.sh` — `--path-arg=1:rw-mkdir`
- `arcanum/_lib/migration-status.json` — flip to `"docker"`

## CI Checks

- `core`: `make core-test` (CircleCI `test` job, `yarn test`). The routing and dispatch-level specs exercise these shell changes.
- `core`: `make core-lint` (CircleCI lint job), only if node's spec changes need it.

## Notes

- `render_issue.sh` stays `--path-arg=1:rw` on purpose. `DiscussIssueRenderIssue` does a plain `writeFile` with no `mkdir`, so creating the parent would break parity.
- The `mkdir -p` runs as the host user before `docker run`, so the created directory has the host user's ownership, same as natively.

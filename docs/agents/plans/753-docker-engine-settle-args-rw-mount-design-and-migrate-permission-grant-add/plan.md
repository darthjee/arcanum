# Plan: Docker engine: settle args:rw mount design and migrate permission-grant-add

Issue: [753-docker-engine-settle-args-rw-mount-design-and-migrate-permission-grant-add.md](../../issues/753-docker-engine-settle-args-rw-mount-design-and-migrate-permission-grant-add.md)

## Overview

Keep the generic `args:rw` parent-directory mount for `permission-grant-add`, and fix the spec so it describes the real callers. The global `settings.json` write runs in-process from migrations and is never dispatched. Make missing-parent parity opt-in per declaration with a new `--path-arg` mode, `rw-mkdir`. A blanket host-side `mkdir -p` would break parity for `discuss-issue-render-issue`, whose native side fails on a missing parent. Then flip `permission-grant-add` to `"docker"` per testing.md → Ticking a checklist row.

## Agents involved

- [architect](architect.md) — spec docs (`mounts.md`, `dispatch.md`, `checklist.md`)
- [scripter](scripter.md) — `engine_dispatch` mode, shims, `migration-status.json`
- [node](node.md) — routing, dispatch-level and docker parity specs

## Shared contracts

- **New `--path-arg` mode `rw-mkdir`.** Validation regex in `_engine_dispatch_docker_valid_path_arg`: `^[1-9][0-9]*:(ro|rw|rw-mkdir)$`. Semantics are identical to `rw` (mount the parent directory read-write at the same path; inside-repo targets get no mount; relative-path rewrite unchanged). The one difference: when the target is outside the repo and its parent directory does not exist, dispatch runs `mkdir -p "$(dirname "$abs")"` **on the host** before mounting, instead of skipping the mount. If that `mkdir -p` fails, the mount is skipped (same as `rw` today), and the command fails in the container the way it would natively. For collapsing nested/duplicate sources, `rw-mkdir` counts as `rw`, and the emitted `-v` has no `:ro` suffix.
- **`rw` stays as is.** A missing parent means no mount. This is for writers that don't `mkdir -p` natively (`discuss-issue-render-issue`).
- **Declarations:**
  - `arcanum/_lib/permission_grant.sh` `add`: `engine_dispatch "$anchor" permission-grant-add <shell> --path-arg=2:rw-mkdir -- "$anchor" "$@"`. Args after `--` are `<anchor> <file> <pattern>`, so `<file>` is index 2. No `--needs`, no env allowlist.
  - `init-claude/scripts/write_label_config.sh`: `--path-arg=1:rw` → `--path-arg=1:rw-mkdir`. `LabelConfig` runs `mkdir -p` natively.
  - `discuss-issue/scripts/render_issue.sh`: stays `--path-arg=1:rw`.
- **Map:** `arcanum/_lib/migration-status.json` → `"permission-grant-add": "docker"`.
- **Checklist row** `permission-grant-add`: mounts `args:rw`, env `—`, issue `#753`, ticked ✅. The notes say `--path-arg=2:rw-mkdir`, that a relative `<file>` assumes cwd = `<anchor>`, and that an out-of-repo target mounts its whole parent read-write.

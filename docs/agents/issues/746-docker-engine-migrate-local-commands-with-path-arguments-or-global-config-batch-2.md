# Issue: Docker engine: migrate local commands with path arguments or global config (batch 2)

## Description

Part of epic #724 (implement `engine.mode=docker`). This is batch 2 of the migration planned in #730. Credential class: **local, with path arguments or global config**. These commands need `args:ro`/`args:rw` or `global-config:ro` mounts and no credentials. Batch 1 (#745) has been merged.

Row details (`credentials`, `mounts`, `env`, `notes`) are in [`docs/agents/specs/docker/checklist.md`](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/checklist.md).

### Commands

6 rows:

| Command | Shim | Mounts | Env |
| --- | --- | --- | --- |
| `arcanum-split-issue-create-sub-issue-file` | `arcanum-split-issue/scripts/create_sub_issue_file.sh` | args:ro | — |
| `discuss-issue-render-issue` | `discuss-issue/scripts/render_issue.sh` | args:rw | — |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | global-config:ro | CLAUDE_CONFIG_DIR |
| `init-claude-write-label-config-add` | `init-claude/scripts/write_label_config.sh` `add` | args:rw | — |
| `init-claude-write-label-config-remove` | `init-claude/scripts/write_label_config.sh` `remove` | args:rw | — |
| `init-claude-write-label-config-replace` | `init-claude/scripts/write_label_config.sh` `replace` | args:rw | — |

## Problem

`permission-grant-add` was originally part of this batch. It was split out to #753. With a global `settings.json` target, the `args:rw` parent-directory mount would expose all of `CLAUDE_CONFIG_DIR` read-write. A missing parent directory would also silently lose the write under docker. Its mount design has to be settled before it can migrate, so this batch covers the remaining 6 rows only.

## Expected Behavior

Per [testing.md → Ticking a checklist row](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/testing.md#ticking-a-checklist-row), for every command above:

- the shim's `--needs`/`--path-arg` declarations match the row's `mounts`/`env` columns;
- the shim-level routing spec has a `docker` callback;
- there is a parity case under `core/spec/docker/` (run with `make docker-parity`, platform reported in the PR), or a `notes` entry saying why there is none;
- in the same PR, the command flips to `"docker"` in `arcanum/_lib/migration-status.json` and its checklist row is ticked ✅ with this issue's number.

Follow the pattern batch 1 (#745) set: docker callbacks in the shim routing specs, and parity cases grouped per skill under `core/spec/docker/`.

`init-claude-stamp-arcanum-version` must stamp the same version under docker as natively. The image carries an `arcanum.json` built from `ARCANUM_VERSION` (see [image.md](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/image.md)). Its parity case should cover a tagged/zip install. If a dev install between tags (built as `local-<sha>`) does not stamp the same as natively, say so in a `notes` entry.

### Out of scope

- The commands of the other batches (batch 1, batch 3, batch 4, batch 5).
- `permission-grant-add`: moved to #753.
- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`: handled by #733.

Owner: scripter / node.

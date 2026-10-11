# Plan: Docker engine: migrate local commands with path arguments or global config (batch 2)

Issue: [746-docker-engine-migrate-local-commands-with-path-arguments-or-global-config-batch-2.md](../../issues/746-docker-engine-migrate-local-commands-with-path-arguments-or-global-config-batch-2.md)

## Overview

Move 6 commands to `"docker"` (`permission-grant-add` was moved to #753). They are the first commands that need more than the repo mount. Each shim declares its `--path-arg`/`--needs` flags. Each command gets a `docker` callback in its shim-level routing spec and a parity case under `core/spec/docker/`. In the same PR, its status flips to `"docker"` and its checklist row is ticked. The work follows the pattern batch 1 (#745) set, generalized for extra mounts.

## Agents involved

- [scripter](scripter.md): shim declarations and headers, `migration-status.json`, checklist, spec status note.
- [node](node.md): routing-spec helper for extra mounts, docker routing callbacks, parity cases.

## Shared contracts

The shim declarations scripter adds and node asserts. Indices are 1-based into the args after `--`, never counting the repo path `--prepend-repo-path` adds:

| Command | Shim | Flags added before `--` | Expected extra `docker run` mounts / env |
| --- | --- | --- | --- |
| `arcanum-split-issue-create-sub-issue-file` | `arcanum-split-issue/scripts/create_sub_issue_file.sh` (`-- "$@"` = `<repo_path> <issue_id> <title> <body_file>`) | `--path-arg=4:ro` | `<body_file>:<body_file>:ro` when the body file sits outside the repo; none when inside |
| `discuss-issue-render-issue` | `discuss-issue/scripts/render_issue.sh` (`--prepend-repo-path -- "$@"`, `$1` = `<output_file>`) | `--path-arg=1:rw` | `<dirname output_file>` mounted `rw` when outside the repo |
| `init-claude-stamp-arcanum-version` | `init-claude/scripts/stamp_arcanum_version.sh` | `--needs=global-config` | `$CLAUDE_CONFIG_DIR/arcanum-config.json:ro` if it exists, plus `-e CLAUDE_CONFIG_DIR=<host path>` |
| `init-claude-write-label-config-{add,remove,replace}` | `init-claude/scripts/write_label_config.sh` (`--prepend-repo-path -- "$ABS_CONFIG_PATH" "$@"`) | `--path-arg=1:rw` | `<dirname config_path>` mounted `rw` when outside the repo |

`HOME` stays in the stamp shim's allowlist: natively it lets `git describe` resolve a git-clone install's tag. Under docker, `InstallVersion` reads the image's own `arcanum.json` instead (see `docs/agents/specs/docker/image.md`).

Order: scripter's shim flags land first, since node's routing assertions check for them. Status flips and checklist ticks go in the same PR, once node's parity cases pass.

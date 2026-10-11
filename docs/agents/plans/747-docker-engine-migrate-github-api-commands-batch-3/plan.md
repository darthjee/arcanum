# Plan: Docker engine: migrate GitHub API commands (batch 3)

Issue: [747-docker-engine-migrate-github-api-commands-batch-3.md](../../issues/747-docker-engine-migrate-github-api-commands-batch-3.md)

## Overview

Move the 31 `gh`-credential commands to `"docker"`. Host-side token resolution and `-e GH_TOKEN` forwarding already exist in `arcanum/_lib/engine_dispatch_docker.sh` behind `--needs=gh`. This batch declares the needs in each shim, adds a `docker` callback to each shim's routing spec, and adds opt-in gh parity cases (`itWithGh`) against an env-configured sandbox repo for the read-only and label-mutation commands. The other commands get a checklist `notes` entry instead. In the same PR, the statuses flip and the checklist rows are ticked, following the pattern from batches 1 and 2 (#745, #746).

## Agents involved

- [scripter](scripter.md): shim flags and headers, `migration-status.json`, the checklist, and the spec status note.
- [node](node.md): routing-spec docker callbacks, the gh sandbox parity harness and cases, and the testing.md env docs.

## Shared contracts

Every batch-3 shim call gets `--needs=global-config,gitconfig,gh`, in the `engine_dispatch` segment before `--` and before the env names, in the single-token `--flag=value` form. The `HOME` allowlist entry stays. Rows marked `args:ro` also get a `--path-arg`. Indices are 1-based into the args after `--`:

| Command | Shim (args after `--`) | Extra flag |
| --- | --- | --- |
| `github-issue-create` | `arcanum/_lib/github_issue.sh` (`<repo_path> <title> <file>`) | `--path-arg=3:ro` |
| `github-issue-update` | `arcanum/_lib/github_issue.sh` (`<repo_path> <id> <title> <file>`) | `--path-arg=4:ro` |
| `spawn-issue` | `arcanum/_lib/spawn_issue.sh` (`<repo_path> <parent_id> <title> <body_file> [--as-subissue]`) | `--path-arg=4:ro` |
| `auto-fix-issue-github-pr-create` | `auto-fix-issue/scripts/github.sh` (`"${@:2}"` = `<repo_path> <title> <file>`) | `--path-arg=3:ro` |
| `init-claude-sync-labels` | `init-claude/scripts/sync_labels.sh` (`<repo_path> <abs_config_path>`) | `--path-arg=2:ro` |

Expected `docker run` additions, which node asserts:

- `$CLAUDE_CONFIG_DIR/arcanum-config.json:ro` when it exists, plus `-e CLAUDE_CONFIG_DIR`.
- the gitconfig `:ro` mount plus `-e GIT_CONFIG_GLOBAL`.
- `-e GH_TOKEN`, by name only, never `GH_TOKEN=<value>` in argv. On a non-github.com host it is `-e GH_HOST` + `-e GH_ENTERPRISE_TOKEN` instead.
- for a path-arg outside the repo, `<file>:<file>:ro`. Inside the repo, no extra mount.

Both call sites in `auto-fix-all/scripts/github.sh` that use `auto-fix-all-github-has-label` (`has-label` and `has-shipit-label`) get the flags. `auto-fix-all-github-cleanup-branch` and `auto-fix-issue-github-info` are not batch 3: leave them untouched.

Sandbox env, defined by node and documented in testing.md:

- `ARCANUM_DOCKER_PARITY_GH_REPO=<owner/repo>`
- `ARCANUM_DOCKER_PARITY_GH_ISSUE=<n>`: an open fixture issue whose labels the mutation cases may toggle and then restore.
- `ARCANUM_DOCKER_PARITY_GH_PR=<n>` and the PR's head branch, for the PR lookups.

When `ARCANUM_DOCKER_PARITY_GH=1` is set but a required fixture var is missing, the case is pending with a message naming the missing var. It never fails.

Order: scripter's shim flags land first, since node's routing assertions check for them. Status flips and checklist ticks go in the same PR, after node's gh parity suite has run once for real (`ARCANUM_DOCKER_PARITY_GH=1 make docker-parity`). The PR reports the platform and the result.

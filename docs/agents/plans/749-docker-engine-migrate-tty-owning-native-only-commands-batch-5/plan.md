# Plan: Docker engine: migrate TTY-owning native-only commands (batch 5)

Issue: [749-docker-engine-migrate-tty-owning-native-only-commands-batch-5.md](../../issues/749-docker-engine-migrate-tty-owning-native-only-commands-batch-5.md)

## Overview

Make `arcanum-create-issue-start` and `arcanum-create-issue-publish` run in docker under `engine.mode=docker`, following the batch-4 (#748) recipe. The scripter adds `--needs` to both native-only shims, rewrites their stale header comments, and ticks the checklist rows. The node agent flips both statuses to `"docker"`, replaces the "not docker-ready" routing case with real docker routing cases, and adds parity cases. In those cases the native side runs without a controlling terminal, so both sides take the exit-4 `FALLBACK=chat` path the same way.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Dispatch command names:** `arcanum-create-issue-start`, `arcanum-create-issue-publish` (the keys in `arcanum/_lib/migration-status.json`).
- **Shim dispatch calls:** keep `--native-only`, keep `HOME` as the only explicit env name, add `--needs=global-config,gitconfig,gh` (this matches the batch-3 gh shims, e.g. `auto-fix-issue/scripts/github.sh`). No `--path-arg`: drafts live under `<repo>/.claude/state/create-issue/`, inside the repo mount, which keeps the same absolute path in the container (`-v <repo>:<repo>`). So the absolute `DRAFT=` paths and `--resume <draft>` paths mean the same thing on both sides.
- Exact shim lines after the change:
  - `engine_dispatch "$REPO_PATH" arcanum-create-issue-start "" --native-only --needs=global-config,gitconfig,gh HOME -- "$@"`
  - `engine_dispatch "$REPO_PATH" arcanum-create-issue-publish "" --native-only --needs=global-config,gitconfig,gh HOME -- "$@"`
- **Docker mounts and env asserted by routing specs:** the global-config file `:ro`, the global gitconfig `:ro`, `GH_TOKEN` forwarded by name only, and no `-t`/TTY flag.
- **Status flip:** node sets both keys to `"docker"` first, so the docker routing cases can run. The scripter then regenerates `docs/agents/architecture/entrypoint-migration-status.md` and ticks the checklist rows with `#749`.
- **Exit-4 contract (unchanged):** a call that needs a prompt prints `FALLBACK=chat` (plus `DRAFT=` lines for `start`) and exits 4. Calls with `--new`, `--resume <draft>`, `--confirmed` or `--shipit-confirmed` never touch the TTY.
- **Order:** node 01 → scripter 01 → node 02 → node 03 → scripter 02.

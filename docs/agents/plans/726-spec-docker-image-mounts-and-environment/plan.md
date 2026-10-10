# Plan: Spec: docker image, mounts and environment

Issue: [726-spec-docker-image-mounts-and-environment.md](../../issues/726-spec-docker-image-mounts-and-environment.md)

## Overview

Replace the three stubs `docs/agents/specs/docker/image.md`, `mounts.md` and `environment.md` with the full spec. Then fill in the `mounts`, `env` and `?` `credentials` cells of `docs/agents/specs/docker/checklist.md`, and update `docs/agents/specs/docker.md` to mark the open points this issue resolves. This is docs-only work. No Dockerfile, script or `core/` code changes: those belong to #728 and #729.

## Context

Part of epic #724. #725 delivered the index and checklist. The user already settled these decisions during `/discuss-issue`, and the spec must record them as decided, not as options:

- **Image:** `core/Dockerfile` becomes multi-stage. A shared base stage, `darthjee/node`, adds pinned `jq`, `git`, `gh` and `openssh-client`. Two targets build on it:
  - `test`: today's behavior, kept as is;
  - `runtime`: bakes `core/` and its production `node_modules` in. It has its own entrypoint (or none), with no `chown` and no `su`, and runs as `--user $(id -u):$(id -g)`.
- **Distribution:** release CI publishes `darthjee/arcanum:<arcanum version>` as a multi-arch image (amd64 + arm64). If the pull fails, dispatch builds the image locally from the install's `core/` (`--target runtime`). If that fails too, it counts as "Docker unavailable" and dispatch falls back to native with a warning.
- **gh credentials:** dispatch forwards the host's `GH_TOKEN`/`GITHUB_TOKEN`, or otherwise runs `gh auth token` on the host, and passes the result via `-e GH_TOKEN` (an env var, never argv). This applies only to commands whose `credentials` cell includes `gh`. `~/.config/gh` is never mounted.

Every part must follow the **Security principles** in `docs/agents/specs/docker.md`.

Codebase facts the spec must account for:

- `arcanum/_lib/engine_dispatch.sh` `_engine_dispatch_run_native` runs `core/bin/arcanum` under `env -i`. It passes `PATH`, `ARCANUM_REPO_PATH` and a per-command allowlist of env var **names**. Many commands put `HOME` on that list, for example every `github-issue-*` command in `arcanum/_lib/github_issue.sh`, because `gh`, git and the config chain read files under it.
- `core/lib/context/ClaudeContext.js` resolves the Claude config dir as `CLAUDE_CONFIG_DIR || $HOME/.claude`. The container has a synthetic `HOME`, so dispatch must resolve `CLAUDE_CONFIG_DIR` on the host and pass it explicitly. It is mounted at the same path.
- `arcanum/_lib/lock.sh` writes a `${HOSTNAME}-$$-<ns>` instance id into a `LOCK_FILE` that sits next to the shared JSON state file. Host and container processes can share locks only if that file's directory is bind-mounted `rw` at the same path. The hostname/pid id stays unique across the host and containers.
- `core/docker-entrypoint.sh` runs as root and `chown`s `/home/node/app/core` and `node_modules`. The `runtime` target must not use it.

## Steps

- [01 — Write image.md](plan/01-write-image-md.md)
- [02 — Write mounts.md](plan/02-write-mounts-md.md)
- [03 — Write environment.md](plan/03-write-environment-md.md)
- [04 — Fill the checklist and update the index](plan/04-fill-checklist-and-index.md)

## CI Checks

- Markdown is linted by Codacy using `.markdownlint.json`. No local CI job covers `docs/`. Keep tables and lists markdownlint-clean.

## Notes

- Keep the scope to the spec. Where a detail is really an implementation choice for #728/#729 (for example the exact base-image tag bump, or the CI publishing workflow), record it as a requirement or a follow-up, not as code.
- The release-CI image publishing has no sub-issue yet. Note it in `image.md` and in `docker.md`'s sub-issue map as part of #728, or flag it as needing a new sub-issue of #724.
- `auto-fix-issue-run-checks` runs the target project's own `.claude/scripts/check_<agent>.sh`. Its credentials and mounts can't be known in general. Record it as "inherits the target project's needs" and note that #727/#733 decide whether it runs in docker at all.
- Exact `docker run` shape, TTY, concurrency and exit-code passthrough are #727 (`dispatch.md`). Link to it instead of deciding those here.

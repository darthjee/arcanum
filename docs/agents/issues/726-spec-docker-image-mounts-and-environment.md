# Issue: Spec: docker image, mounts and environment

## Description

Part of epic #724 (implement `engine.mode=docker`). Write the image, mounts and environment parts of the docker spec: replace the stubs `docs/agents/specs/docker/image.md`, `docs/agents/specs/docker/mounts.md` and `docs/agents/specs/docker/environment.md`. Also fill the `mounts` and `env` columns, and resolve the `?` `credentials` values, in `docs/agents/specs/docker/checklist.md`. This is spec-only work. No Dockerfile, script or dispatch code changes here: those belong to #728 (image) and #729 (dispatch).

The dependency #725 (index + checklist) has landed. Every part must follow the **Security principles** in `docs/agents/specs/docker.md`: minimal mounts, `ro` by default, no tokens baked into the image or passed as arguments, host uid instead of root, no `--privileged`, no Docker socket.

Owner: architect, with `infra` consulted on the image and mount details.

## Problem

`docs/agents/specs/docker.md` lists several open points that block #728 (build the runtime image) and, through it, #729 (docker branch of `engine_dispatch.sh`): image strategy, platforms, path identity, worktrees, paths outside the repo, file ownership, credentials and nested calls. Today `core/Dockerfile` is a test image. It bind-mounts the source, installs dependencies at start, and its `core/docker-entrypoint.sh` runs as root and `chown`s mount points before dropping to `node` (uid 1000). None of that is safe or fast against a user's repo.

## Expected Behavior

After this issue, the three docs are written, the matching open points in `docker.md` are marked resolved (with links to the part that resolves each), and the checklist's `mounts`/`env`/`credentials` columns have no `?` left wherever the answer is already knowable. #728 and #729 can then be implemented from the spec alone.

## Solution

### `image.md` (decided)

- **Strategy: one shared base, two targets.** `core/Dockerfile` becomes a multi-stage file:
  - a common base stage: `darthjee/node` plus pinned `jq`, `git`, `gh`, `openssh-client`;
  - the `test` target, which behaves like the current image (bind-mounted source, `core/docker-entrypoint.sh`, used by `core/docker-compose.yml` and the `core-*` Makefile targets);
  - a new `runtime` target that bakes `core/` and its production `node_modules` in.
- **Runtime entrypoint:** the `runtime` target has its own entrypoint, or none, with no `chown` and no `su`. It runs directly as the host uid/gid (`--user $(id -u):$(id -g)`), so `core/docker-entrypoint.sh` never touches a user's repo. The spec covers what an arbitrary uid needs, for example a writable `HOME` such as `HOME=/tmp` or a tmpfs, and no dependency on `/etc/passwd`.
- **Version pins:** pinning policy for the base image and apt packages, following the existing `jq` pin convention.
- **Distribution: registry, with a local build as fallback.**
  - Release CI publishes `darthjee/arcanum:<arcanum version>` as a multi-arch image (amd64 + arm64).
  - Dispatch uses the tag matching the installed arcanum version.
  - If that tag can't be pulled, dispatch builds it locally from the install's `core/` (`--target runtime`) with the same tag.
  - If both fail, that counts as "Docker unavailable": fall back to native with the warning.
  - Document how the image tag is versioned alongside arcanum releases and `/arcanum-update`. The CI publishing work itself is noted as follow-up for #728 or a new sub-issue.
- **Platforms:** arm64/amd64, and macOS Docker Desktop vs. Linux differences that affect the image.

### `mounts.md`

- **Repo:** mounted at the **same absolute path** as on the host (`-v "$REPO_PATH:$REPO_PATH"`, `-w "$REPO_PATH"`), so emitted paths (`FILE=…`, `REPO_PATH`) stay valid for skills on the host. `rw`.
- **Git worktrees:** when `$REPO_PATH/.git` is a file, also mount the git common dir (`git rev-parse --git-common-dir`) at its own same absolute path, `rw`.
- **Paths outside the repo:** decide for each path whether to mount it, at the same path, `ro` unless the checklist says a command writes to it:
  - `$CLAUDE_CONFIG_DIR` (global config, installed skills, auto-fix-all/monitor state);
  - the arcanum install (shell scripts the native code shells out to);
  - scratchpad and `/tmp`, including the lock directory, so locks keep working across host and container processes;
  - `~/.gitconfig`.
- **File ownership:** `--user $(id -u):$(id -g)`, so files written into the repo stay owned by the host user. Cover the behavior differences between Linux and macOS Docker Desktop (virtiofs/gRPC FUSE).
- Explain how the per-command `mounts` column in the checklist is derived, and fill it in.

### `environment.md`

- **Env vars:** map each command's existing `engine_dispatch` env-var allowlist to `-e NAME` flags (the value is forwarded from the host env, never passed in argv). `PATH` is not forwarded: the image has its own. `ARCANUM_REPO_PATH` is always set.
- **gh credentials (decided):** for commands whose `credentials` column includes `gh`, dispatch forwards an existing host `GH_TOKEN`/`GITHUB_TOKEN`, or else runs `gh auth token` on the host, and passes the result with `-e GH_TOKEN` (env, never argv). `~/.config/gh` is not mounted, because the token lives in the OS keychain on macOS. Also cover GitHub Enterprise hosts (`GH_HOST`/`GH_ENTERPRISE_TOKEN`), since arcanum resolves the domain from the remote.
- **Git remote access over SSH:** for `git-push (ssh)` commands, forward the SSH agent (Linux: mount `$SSH_AUTH_SOCK` and set it; macOS Docker Desktop: `/run/host-services/ssh-auth.sock`), plus `~/.ssh/known_hosts` `ro`. Never mount private keys.
- **Nested-call marker:** `ARCANUM_IN_DOCKER=1` is set inside the container. When `engine_dispatch.sh` sees it, it runs the native implementation directly and never starts a container from inside one. The dispatch side of this is detailed in #727.
- Fill the checklist's `env` column (env vars needed beyond the existing allowlist) and resolve the `?` `credentials` values, for example `auto-fix-issue-run-checks`.

### Docs housekeeping

- Update the `docker.md` Status, Open points and sub-issue map to reflect what this issue resolves.

## Benefits

- #728 can build the runtime image, and #729 can write the `docker run` invocation, without re-deciding the design.
- The security-sensitive choices (credentials, mounts, uid) are made once, explicitly, in one place.
- The checklist becomes usable for planning the migration batches in #730, which group entrypoints by required mounts and credentials.

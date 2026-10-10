# Docker Engine: Image

Part of the [Docker Engine spec](../docker.md) (epic #724). Written in #726, implemented in #728.

This part defines the image that `engine.mode=docker` runs commands in: how it is built, who it runs as, how it is pinned, and how dispatch gets a copy matching the installed arcanum version. Mounts are in [mounts.md](mounts.md), env vars and credentials in [environment.md](environment.md), and the `docker run` invocation itself in [dispatch.md](dispatch.md#docker-run-invocation-shape).

## Strategy: one shared base, two targets

`core/Dockerfile` becomes a multi-stage file:

| Stage | Built from | Used by | Contents |
| --- | --- | --- | --- |
| `base` | `darthjee/node:<pinned tag>` | the two targets below | pinned `jq`, `git`, `gh`, `openssh-client`, plus the passwd-entry helper (see [Runtime user](#runtime-user-and-entrypoint)) |
| `test` | `base` | `core/docker-compose.yml`, the root `Makefile`'s `core-*` targets | today's behavior, unchanged: source bind-mounted, `core/docker-entrypoint.sh`, `yarn install --frozen-lockfile && yarn test` |
| `runtime` | `base` | `engine.mode=docker` | the arcanum install baked in (see below), its own entrypoint, no root phase |

Why this layout:

- **Not a second Dockerfile:** one file means one set of pins. The test image and the runtime image can't drift apart on `jq`, `git` or `gh` versions, so a parity spec that passes under `test` says something about `runtime`.
- **Not the current test image as is:** it installs dependencies at every container start (seconds per call, on a path that runs many times per skill), and its entrypoint runs as root and `chown`s mount points. Against a user's repo that is both slow and unsafe.

### What the `runtime` target bakes in

The native code is not self-contained under `core/`. `core/lib/utils/file/InstallRoot.js` resolves `INSTALL_ROOT` four levels above its own file, and native commands use it for:

- `arcanum/_lib/config_chain.sh`, which `core/lib/core/dispatcher.js` sources for **every** command (`InvocationLog`);
- skill templates (`discuss-issue/templates/`, `auto-fix-all/templates/`, `init-claude/templates/`);
- sibling shims that native commands shell out to, such as `arcanum-split-issue/scripts/github.sh` and `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`. Those shims go through `engine_dispatch.sh` again (see [Nested calls](environment.md#nested-call-marker)).

So the `runtime` target copies the **install layout**, not just `core/`: the same file set as the release zip (`scripts/build_release_zip.sh`), under a fixed path such as `/opt/arcanum`, with `core/bin/arcanum` at `/opt/arcanum/core/bin/arcanum`. Requirements for #728:

- The build context is the install root, with `-f core/Dockerfile --target runtime`. The `test` target keeps working from `core/docker-compose.yml`, which may need its `context`/`dockerfile` adjusted to match.
- Production dependencies are installed with `yarn install --production --frozen-lockfile`. `core/package.json` has no runtime `dependencies` today, so this step installs nothing, but it stays so that adding one doesn't silently break the image.
- An `arcanum.json` with the install's version is written into the image root (`--build-arg ARCANUM_VERSION`), so `InstallVersion` resolves the same version inside the container as on the host, even for a local build from a git-clone install, whose `.git` is not copied.
- A `.dockerignore` keeps `core/node_modules`, `coverage/`, `.git` and `docs/` out of the context.

## Runtime user and entrypoint

The container always runs as the host user: dispatch passes `--user "$(id -u):$(id -g)"` (see [mounts.md](mounts.md#file-ownership)). The `runtime` target has no `USER` root phase, no `chown` and no `su`. `core/docker-entrypoint.sh` stays test-only.

An arbitrary uid has no `/etc/passwd` entry in the image. What that means:

- **arcanum's own code** never looks the user up (no `whoami`, `getent`, `os.userInfo()`), and must keep it that way.
- **`HOME`** is set to a writable path that does not depend on the uid: `ENV HOME=/tmp/arcanum-home`, created at start, with `/tmp` a tmpfs (dispatch passes `--read-only` and `--tmpfs /tmp`, see [dispatch.md](dispatch.md#docker-run-invocation-shape)). `gh` and `git` write small caches under it. Nothing in it persists between calls.
- **OpenSSH does look the user up:** `ssh` aborts with `No user exists for uid` when `getpwuid` fails, so `git` over SSH breaks without an entry. The image therefore provides a passwd/group entry for the running uid at start. The recommended mechanism is `nss_wrapper` (pinned `libnss-wrapper`): the entrypoint writes a one-line passwd and group file under `$HOME` and sets `LD_PRELOAD`, `NSS_WRAPPER_PASSWD` and `NSS_WRAPPER_GROUP`. A writable `/etc/passwd` is rejected. #728 makes the final choice, but it must not need root and must survive nested `env -i` calls (see [environment.md](environment.md#container-infrastructure-env)).
- **git `safe.directory`:** on Linux, bind-mounted files keep the host uid, which is also the container uid, so git's dubious-ownership check passes. On macOS Docker Desktop, ownership inside the container is mapped by the file-sharing layer and may not match. Dispatch therefore always sets `safe.directory` for exactly the repo path and the git common dir (never `*`), through `GIT_CONFIG_COUNT` env, not by writing any config file. See [environment.md](environment.md#fixed-env).

The entrypoint is a small `sh` script (or `node` directly, if no passwd setup is needed) that does the setup above and then `exec`s `/opt/arcanum/core/bin/arcanum "$@"`. Dispatch passes the command name and its arguments exactly as `_engine_dispatch_run_native` does today.

## Version pins

Every input is pinned, following the existing `jq` convention in `core/Dockerfile`: an exact version string next to a comment explaining how to find the current candidate when refreshing it.

- **Base image:** an exact `darthjee/node:<x.y.z>` tag, shared by both targets. A digest pin (`@sha256:…`) is allowed on top of the tag. #728 decides.
- **apt packages:** `jq`, `git`, `openssh-client` (and `libnss-wrapper`, if chosen) as `pkg=<version>`, with `--no-install-recommends`, from the base image's Debian release.
- **`gh`:** Debian's own `gh` package lags far behind. Install it either from GitHub's apt repository, with its signing key pinned by fingerprint and the package pinned as `gh=<version>`, or from a release tarball pinned by version and checked against a SHA-256. #728 picks one. Either way the version is explicit and the refresh procedure is written next to it.

Refreshing a pin is a normal PR. Pins change the image content, so they only reach users through the next arcanum release (see below).

## Distribution and versioning

**Registry first, local build as fallback.**

1. **Tag:** dispatch uses `darthjee/arcanum:<version>`, where `<version>` is the installed arcanum version, resolved on the host the same way `InstallVersion` does: the install's `arcanum.json` `.version` (zip install), or the exact git tag on HEAD (git-clone install).
2. **Pull:** if the tag is not present locally, dispatch pulls it.
3. **Local build:** if the pull fails (offline, no such tag), dispatch builds the image from the install itself, `docker build -f core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=<version> -t darthjee/arcanum:<version> <install root>`, and uses it.
4. **Docker unavailable:** if both fail, that counts as "Docker unavailable" and dispatch falls back to native on the host, with the warning described in [docker.md](../docker.md#decisions-so-far).

A dev install with no exact version (a git clone between tags, like a contributor's checkout) skips the pull and builds locally as `darthjee/arcanum:local-<short HEAD>`. Uncommitted changes are not detected. How a contributor forces a rebuild is #729's call.

Rules:

- Published tags are immutable. A release never overwrites an existing tag. A fix ships as a new arcanum version, and therefore as a new image tag.
- `/arcanum-update` needs no docker-specific step. Updating the install changes the resolved version, and the next docker call pulls (or builds) the matching tag. Old tags stay local until the user prunes them.
- **Publishing:** release CI (`.circleci/config.yml`) builds the `runtime` target with buildx for `linux/amd64` and `linux/arm64` and pushes `darthjee/arcanum:<version>` as one multi-arch manifest, at the same point the release zip is published. This job has no sub-issue yet. It is follow-up work, tracked under #728 or a new sub-issue of #724 (see [docker.md](../docker.md#sub-issue-map)).

## Platforms

- **Architectures:** the published manifest covers `linux/amd64` and `linux/arm64`, so Apple Silicon Macs and arm64 Linux hosts run natively with no emulation. A local build always targets the host's own architecture.
- **Linux:** containers run on the host kernel. Bind mounts are native, and uids pass through unchanged. Overhead is mostly `docker run` startup.
- **macOS Docker Desktop:** containers run in a Linux VM. Bind mounts go through the file-sharing layer (virtiofs by default, gRPC FUSE on older setups), which is slower for many small file operations and maps ownership (see [mounts.md](mounts.md#file-ownership)). Mounted paths must be inside Docker Desktop's shared directories, which by default include `/Users`, `/Volumes`, `/private`, `/tmp` and `/var/folders`. The per-call cost on macOS is part of the benchmark in [dispatch.md](dispatch.md#per-call-docker-run-and-when-to-revisit-it).
- **Windows:** out of scope. Arcanum's scripts target macOS and Linux.

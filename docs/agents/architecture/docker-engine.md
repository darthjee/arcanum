# Docker Engine

`engine.mode=docker` runs arcanum's scripts inside a per-call container instead of on the host. The container mounts the repo being worked on, plus whatever other paths each command declares it needs. Each command keeps its stdout/exit-code contract unchanged, so skills never know which engine ran it. Only the scripts are containerized: Claude Code itself, and the top-level `scripts/` folder (repo release tooling), always run on the host.

This page is the permanent design, built in epic [#724](https://github.com/darthjee/arcanum/issues/724). How `engine.mode` is read and how the shell and native engines dispatch is in [Script Engine](script-engine.md). Which command runs where is rendered from `arcanum/_lib/migration-status.json` in [Entrypoint Migration Status](entrypoint-migration-status.md).

## Security principles

These bind every section below:

- Mount the minimum, read-only by default. A path is mounted `rw` only when the command writes to it.
- Never bake tokens into the image or pass them as command-line arguments. Use env vars (by name only) or mounted config, and only for the commands whose shim declares the need.
- The container runs as the host uid, not root.
- No `--privileged`, and no Docker socket mount.

## Fallback rules

Every fallback happens inside `engine_dispatch.sh`, with exactly one warning line on stderr. Skills never see or handle them, and stdout/exit code are those of the implementation that actually ran.

- A command that is not docker-ready (`"native"` in `migration-status.json`) runs **native on the host**. If it has no native implementation (`"shell"`), it runs its shell script, following the existing native → shell rule.
- If Docker is unavailable at call time (binary missing, daemon not reachable, image neither present, pullable nor buildable), the command runs **native on the host**. The warning tells the user to fix Docker or change `engine.mode`.
- If `docker run` itself exits `125`, `126` or `127`, no arcanum code ran, so this also counts as Docker unavailable: the command runs native on the host, exactly once (see [Exit codes and streams](#exit-codes-and-streams)).
- A native command that crashes inside the container does **not** fall back: its exit code and streams pass through, and the failure is loud.

`host-only` commands are not a fallback: they always run native on the host, with no warning (see [Resolution order](#resolution-order)).

## Image

### Strategy: one shared base, two targets

`core/Dockerfile` is a multi-stage file:

| Stage | Built from | Used by | Contents |
| --- | --- | --- | --- |
| `base` | `darthjee/node:<pinned tag>` | the two targets below | pinned `jq`, `git`, `gh`, `openssh-client`, plus `libnss-wrapper` for the passwd entry (see [Runtime user and entrypoint](#runtime-user-and-entrypoint)) |
| `test` | `base` | `core/docker-compose.yml`, the root `Makefile`'s `core-*` targets | source bind-mounted, `core/docker-entrypoint.sh`, `yarn install --frozen-lockfile && yarn test` |
| `runtime` | `base` | `engine.mode=docker` | the arcanum install baked in under `/opt/arcanum`, its own entrypoint, a non-root default `USER 1000:1000` (overridden by dispatch's `--user`), no root phase |

Why this layout:

- **One Dockerfile:** one set of pins. The test image and the runtime image can't drift apart on `jq`, `git` or `gh` versions, so CI's `yarn test` under `test` says something about `runtime`.
- **Not the test image as is:** it installs dependencies at every container start and its entrypoint runs as root and `chown`s mount points. Against a user's repo that is both slow and unsafe.

`make core-build-runtime` builds the `runtime` target locally, and `make core-smoke-runtime` runs its entrypoint setup without starting the CLI.

### What the runtime target bakes in

The native code is not self-contained under `core/`. `core/lib/utils/file/InstallRoot.js` resolves `INSTALL_ROOT` four levels above its own file, and native commands use it for `arcanum/_lib/config_chain.sh` (sourced by `core/lib/core/dispatcher.js` for every command, for `InvocationLog`), skill templates, and sibling shims that native commands shell out to (those go through `engine_dispatch.sh` again, see [Nested-call guard](#nested-call-guard)).

So the `runtime` target copies the **install layout**, not just `core/`: the same file set as the release zip (`scripts/build_release_zip.sh`), under `/opt/arcanum`, with the CLI at `/opt/arcanum/core/bin/arcanum`.

- The build context is the install root, with `-f core/Dockerfile --target runtime`.
- Production dependencies are installed with `yarn install --production --frozen-lockfile`. `core/package.json` has no runtime `dependencies` today, so this installs nothing, but it stays so that adding one doesn't silently break the image.
- An `arcanum.json` with the install's version is written into the image root (`--build-arg ARCANUM_VERSION`), so `InstallVersion` resolves the same version inside the container as on the host, even for a git-clone install, whose `.git` is not copied.
- `.dockerignore` keeps `core/node_modules`, `coverage/`, `.git` and `docs/` out of the context.

### Runtime user and entrypoint

The container always runs as the host user: dispatch passes `--user "$(id -u):$(id -g)"` (see [File ownership](#file-ownership)). The `runtime` target has no root phase, no `chown` and no `su`. `core/docker-entrypoint.sh` is test-only.

An arbitrary uid has no `/etc/passwd` entry in the image. What that means:

- **arcanum's own code** never looks the user up (no `whoami`, `getent`, `os.userInfo()`), and must keep it that way.
- **`HOME`** is a writable path that does not depend on the uid: `ENV HOME=/tmp/arcanum-home`, created at start, with `/tmp` a tmpfs (dispatch passes `--read-only` and `--tmpfs /tmp`). `gh` and `git` write small caches under it. Nothing in it persists between calls.
- **OpenSSH does look the user up:** `ssh` aborts with `No user exists for uid` without an entry. The image provides one through `nss_wrapper` (pinned `libnss-wrapper`, symlinked to the fixed path `/usr/local/lib/libnss_wrapper.so` so `LD_PRELOAD` does not depend on the architecture). At start, the entrypoint writes a one-line passwd file (`$HOME/passwd`) and group file (`$HOME/group`) for the current uid/gid and exports `LD_PRELOAD`, `NSS_WRAPPER_PASSWD` and `NSS_WRAPPER_GROUP`. A writable `/etc/passwd` is rejected. These variables survive nested `env -i` calls as part of the [container infrastructure env](#container-infrastructure-env).
- **git `safe.directory`:** dispatch always sets it for exactly the repo path and the git common dir (never `*`), through `GIT_CONFIG_COUNT` env, not by writing any config file (see [Fixed env](#fixed-env)). On Linux the ownership check passes anyway; on macOS Docker Desktop the file-sharing layer may map ownership differently.

The entrypoint is `/usr/local/bin/arcanum-entrypoint` (source: `core/docker-runtime-entrypoint.sh`), a small `sh` script. It sources `/usr/local/lib/arcanum-runtime-env.sh` (source: `core/docker-runtime-env.sh`), which does the `HOME` and passwd setup above, then `exec`s `/opt/arcanum/core/bin/arcanum "$@"`. The setup lives in its own sourced file so `make core-smoke-runtime` can run exactly the same setup without the CLI. The entrypoint does not set the git credential helper or `safe.directory`: those come from dispatch env.

### Version pins

Every input is pinned, following the `jq` convention in `core/Dockerfile`: an exact version string next to a comment explaining how to find the current candidate when refreshing it.

- **Base image:** an exact `darthjee/node:<x.y.z>` tag (Debian bookworm, published for `linux/amd64` and `linux/arm64`), shared by both targets, pinned by tag only.
- **apt packages:** `jq`, `git`, `openssh-client` and `libnss-wrapper` as `pkg=<version>`, with `--no-install-recommends`.
- **`gh`:** from GitHub's release tarball, pinned by version (`GH_VERSION`) with one SHA-256 per architecture (`GH_SHA256_AMD64`, `GH_SHA256_ARM64`), verified before extraction. The architecture is read from `dpkg --print-architecture`, not `TARGETARCH`, so the binary always matches the base image's actual platform.

Refreshing a pin is a normal PR. Pins change the image content, so they reach users only through the next arcanum release.

### Distribution and versioning

**Registry first, local build as fallback.**

1. **Tag:** dispatch uses `darthjee/arcanum:<version>`, where `<version>` is the installed arcanum version, resolved on the host the same way `InstallVersion` does: the install's `arcanum.json` `.version` (zip install), or the exact git tag on HEAD (git-clone install).
2. **Pull:** if the tag is not present locally, dispatch pulls it.
3. **Local build:** if the pull fails (offline, no such tag), dispatch builds the image from the install itself, `docker build -f core/Dockerfile --target runtime --build-arg ARCANUM_VERSION=<version> -t darthjee/arcanum:<version> <install root>`, and uses it.
4. **Docker unavailable:** if both fail, dispatch falls back to native on the host (see [Fallback rules](#fallback-rules)).

A dev install with no exact version (a git clone between tags) skips the pull and builds locally as `darthjee/arcanum:local-<short HEAD>`. Uncommitted changes never change the tag, so a contributor testing local edits must remove the image first (`docker rmi darthjee/arcanum:local-<short HEAD>`); the next docker dispatch rebuilds it.

Rules:

- Published tags are immutable. A fix ships as a new arcanum version, and therefore as a new image tag.
- `/arcanum-update` needs no docker-specific step. Updating the install changes the resolved version, and the next docker call pulls (or builds) the matching tag. Old tags stay local until the user prunes them.
- **Publishing:** the `publish-image` job in the `release` workflow of `.circleci/config.yml` builds the `runtime` target with buildx for `linux/amd64` and `linux/arm64` and pushes `darthjee/arcanum:<version>` as one multi-arch manifest. It runs on the same semver tag filter as `build-and-release`, and only after it. Branch builds never publish.
  - It logs in to Docker Hub with the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` CircleCI project env vars.
  - It pushes only the version tag: no `latest` or other moving tag.
  - If `darthjee/arcanum:<version>` already exists, the job fails before building, including on workflow re-runs.
  - A failed image push leaves a release whose zip exists but whose image doesn't. Dispatch still works, through the local build.

See [Install and Release](install-and-release.md) for the release flow the job is part of.

### Platforms

- **Architectures:** the published manifest covers `linux/amd64` and `linux/arm64`, so Apple Silicon Macs and arm64 Linux hosts run with no emulation. A local build always targets the host's own architecture.
- **Linux:** containers run on the host kernel. Bind mounts are native, and uids pass through unchanged. Overhead is mostly `docker run` startup.
- **macOS Docker Desktop:** containers run in a Linux VM. Bind mounts go through the file-sharing layer (virtiofs by default), which is slower for many small file operations and maps ownership (see [File ownership](#file-ownership)). Mounted paths must be inside Docker Desktop's shared directories, which by default include `/Users`, `/Volumes`, `/private`, `/tmp` and `/var/folders`.
- **Windows:** out of scope. Arcanum's scripts target macOS and Linux.

## Mounts

What the container can see of the host filesystem. Every rule follows the [Security principles](#security-principles).

### Path identity

**Every mount uses the same absolute path inside the container as on the host.** Commands print paths (`FILE=…`, `ISSUE_FILE=…`, `PLAN_DIR=…`) that skills then use on the host, take absolute paths as arguments, and read paths stored in files (a worktree's `.git` file holds an absolute `gitdir:`). With identical paths, none of that needs translating.

### Mount table

| Mount | Host path | Mode | When | Why |
| --- | --- | --- | --- | --- |
| Repo | `$REPO_PATH` | `rw` | always, with `-w "$REPO_PATH"` | the target repo, including `.claude/state/` and `.claude/configuration/` |
| Git common dir | `git -C "$REPO_PATH" rev-parse --path-format=absolute --git-common-dir` | `rw` | only when `$REPO_PATH/.git` is a file (a worktree) | refs, objects and `worktrees/<name>/` live there |
| Global arcanum config | `$CLAUDE_CONFIG_DIR/arcanum-config.json` | `ro` | `--needs=global-config`, and only when the file exists | the global tier of the config chain |
| Log location | the resolved `engine.log.location` directory | `rw` | every call, when `engine.log.location` is set and outside the repo | `InvocationLog` appends `arcanum-<repo>-log.txt` there |
| Git global config | the host's global git config file | `ro` | `--needs=gitconfig` | commit identity, `user.ghuser`, aliases and other user settings |
| `known_hosts` | `~/.ssh/known_hosts` | `ro` | `--needs=remote`, ssh remotes only | host-key checking for `git` over SSH |
| SSH agent socket | see [Git remote access](#git-remote-access) | — | `--needs=remote`, ssh remotes only | SSH auth without keys in the container |
| Argument paths | absolute path arguments outside the repo | `ro` or `rw` | `--path-arg` | body files in the scratchpad or `/tmp`, an output file, a settings file |

Not mounted, ever:

- **The arcanum install.** The image carries its own copy at the same version (see [What the runtime target bakes in](#what-the-runtime-target-bakes-in)).
- **The rest of `CLAUDE_CONFIG_DIR`.** It holds Claude Code credentials, session transcripts and other projects' settings. No native command reads anything there except `arcanum-config.json`. The global `settings.json` is written in-process by per-repo migrations, which never go through dispatch. A dispatched `permission-grant-add` against an out-of-repo file mounts that file's parent directory read-write (`--path-arg=…:rw-mkdir`); for the global settings file that is all of `CLAUDE_CONFIG_DIR`. That is an accepted, documented cost, not a current use: a single-file mount can't replace it, because `PermissionGrant` writes `<file>.tmp` and `<file>.lock` beside the file.
- **Host `/tmp` or the scratchpad as a whole.** Native commands that need scratch space use the container's own tmpfs `/tmp`. Files a skill hands over are mounted one by one as argument paths.
- **`~/.ssh` private keys, `~/.ssh/config`, `~/.config/gh`, the Docker socket.** See [Environment](#environment) for how credentials reach the container instead.

### Repo and worktrees

`-v "$REPO_PATH:$REPO_PATH" -w "$REPO_PATH"`, `rw`, for every command. A few shims use `$PWD` as their repo path, which is why the working directory is the repo too.

When the repo is a git worktree, `$REPO_PATH/.git` is a file containing `gitdir: <common dir>/worktrees/<name>`. Dispatch resolves the common dir on the host and mounts it at the same path, `rw`. Only the common dir is mounted, never sibling worktrees.

### Global arcanum config

Dispatch resolves the config dir on the host (`CLAUDE_CONFIG_DIR`, or else `$HOME/.claude`) and passes it as `-e CLAUDE_CONFIG_DIR=<host path>`, because the container's `HOME` is synthetic. Only `arcanum-config.json` under it is mounted, at the same path, `ro`. If it does not exist, nothing is mounted and the global tier reads as empty, as it does natively. No native command writes the global arcanum config, so there is no `rw` variant.

### Shared state and locks

All shared JSON state that commands mutate lives under the repo's `.claude/state/`. `arcanum/_lib/lock.sh` and `core/lib/utils/file/Lock.js` put the lock file next to the state file. The repo mount is `rw` at the same path, so a host process and a container process see the same lock file and exclude each other.

The lock protocol writes a `${HOSTNAME}-<pid>-<time>` instance id and reads it back. Each container gets its own hostname (its container id), and the time component is per call, so ids stay unique across the host and any number of concurrent containers even though container pids restart at 1. See [Lock System](lock-system.md).

### Log location

Dispatch resolves `engine.log.location` on the host with `config_chain_read "$REPO_PATH" engine log.location`, and mounts that directory `rw` at the same path when it is set and outside the repo. Logging failures are swallowed natively, so a location that can't be mounted only loses the log line.

### Git and SSH config

- **Global git config:** dispatch resolves the host's global config file (`$GIT_CONFIG_GLOBAL`, else `~/.gitconfig`, else `${XDG_CONFIG_HOME:-~/.config}/git/config`), mounts it `ro` at the same path, and points `GIT_CONFIG_GLOBAL` at it (see [HOME and the allowlist](#home-and-the-allowlist)).
- **`known_hosts`:** `~/.ssh/known_hosts`, `ro`, at the same path, used through `GIT_SSH_COMMAND`. Only for `remote` commands with an ssh remote.
- **Never** `~/.ssh` itself, `id_*` keys or `~/.ssh/config`.

### Argument paths

Some commands take a file path argument that may point outside the repo. Each such argument is mounted on its own, at the same path: an input file (`ro`) is mounted itself; a file the command writes (`rw`, `rw-mkdir`) gets its parent directory mounted, because the file may not exist yet. Paths inside the repo need nothing extra. The shim declares which arguments are paths, see [Argument path declaration](#argument-path-declaration).

### File ownership

Dispatch always passes `--user "$(id -u):$(id -g)"`, so the container never creates root-owned files in the user's repo.

- **Linux:** bind mounts pass uids through unchanged. Files the container creates are owned by the host user, and git's ownership check passes on its own.
- **macOS Docker Desktop:** the file-sharing layer creates files on the host as the host user, whatever uid the container uses. Inside the container, mounted files may show a different owner, which is why dispatch sets `safe.directory` explicitly.

### Known limitations

These follow from the mounts above. None of them makes a command fall back: a command that hits one fails in the container.

- **Commit signing:** `commit.gpgsign=true` needs the signing agent (GPG or SSH signing), which is not forwarded. Commands that commit fail in the container.
- **Git hooks:** `pre-commit`/`commit-msg` hooks run inside the container and only find tools the image has.
- **Included git config:** `[include]`/`[includeIf]` targets of the global git config are not mounted, so settings that live only there don't apply.

## Environment

Which env vars reach the container, how credentials get there, and how a call made from inside the container avoids starting another one.

### Allowlist mapping

Natively, `_engine_dispatch_run_native` runs `core/bin/arcanum` under `env -i`, with `PATH`, `ARCANUM_REPO_PATH` and the command's own allowlist of env var **names**, each forwarded only when set. Under docker the same allowlist becomes `docker run` flags:

- Each allowlisted name that is set becomes `-e NAME`, with no `=value`. Docker reads the value from the dispatching process's env, so it never appears in argv or `ps`.
- `PATH` is **not** forwarded. The image has its own `PATH`.
- `ARCANUM_REPO_PATH` is always set, to the repo path, which is the same inside and out.
- `HOME` is never forwarded, see below.

Nothing else from the host env reaches the container, except the variables this section adds explicitly.

### HOME and the allowlist

Natively `HOME` is a proxy: `gh` finds its auth through it, git finds `~/.gitconfig`, and `ConfigChain` finds `~/.claude/arcanum-config.json`. The host's `HOME` would point at a directory that is not mounted, so under docker an allowlisted `HOME` is dropped, the container keeps the image's synthetic `HOME`, and what `HOME` stood for arrives explicitly:

| Natively through `HOME` | Under docker |
| --- | --- |
| `~/.claude/arcanum-config.json` | `-e CLAUDE_CONFIG_DIR=<host path>` plus the global-config mount |
| `~/.gitconfig` | `-e GIT_CONFIG_GLOBAL=<host path>` plus the gitconfig mount |
| `~/.ssh/known_hosts` | the `known_hosts` mount, used through `GIT_SSH_COMMAND` |
| `gh` auth under `~/.config/gh` or the keychain | `-e GH_TOKEN` |

### gh credentials

For commands that declare `--needs=gh` (and `remote` commands with an https remote), dispatch resolves a token **on the host** and passes it by env:

1. If `GH_TOKEN` or `GITHUB_TOKEN` is already set in the dispatching process, use it.
2. Otherwise run `gh auth token --hostname <host>` on the host, where `<host>` is the domain `arcanum/_lib/origin.sh` resolves from the repo's remote. When `user.ghuser` is set in git config, add `--user <ghuser>`, which replaces the `gh auth switch --user` that `GithubToken` does natively. Inside the container, `gh auth switch` has no config to switch, only warns, and never fails the command.
3. Put the result in the dispatching process's env and pass it as `-e GH_TOKEN`. It never goes in argv.

Rules:

- `~/.config/gh` is **never** mounted.
- **GitHub Enterprise:** when the resolved host is not `github.com`, dispatch sets `-e GH_HOST=<host>` and passes the token as `-e GH_ENTERPRISE_TOKEN` instead.
- **No token:** the command still runs without one and fails the way it would natively. Dispatch never prompts.
- The token lives only in the dispatching process's env and the container's env for the length of one call.

### Git remote access

Commands that declare `--needs=remote` (any `fetch`, `push` or `pull` against the remote) get remote credentials. Dispatch reads the remote URL on the host (`origin.sh`) and picks the transport.

**ssh remote:** forward the host's SSH agent, never a key.

- **Linux:** `-v "$SSH_AUTH_SOCK:/run/arcanum/ssh-agent.sock" -e SSH_AUTH_SOCK=/run/arcanum/ssh-agent.sock`, at a fixed path because the host's socket usually sits under a per-session temp directory.
- **macOS Docker Desktop:** `-v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock -e SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock`, Docker Desktop's built-in proxy to the macOS agent.
- `known_hosts` is mounted `ro`, and `GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=<host known_hosts path> -o StrictHostKeyChecking=yes"` makes ssh use it. An unknown host key fails; the container never adds one.
- **No agent:** the command runs anyway and git fails the way it would natively.

**https remote:** git authenticates with the gh token. Dispatch passes `GH_TOKEN` (as above) and points git's credential helper at gh through `GIT_CONFIG_COUNT` env: first an empty `credential.helper`, which clears any host helper such as `osxkeychain`, then `credential.helper=!gh auth git-credential`. That is what `gh auth setup-git` would write, without writing any file.

Known divergence: under `engine.mode=native` the shims run under `env -i` without `SSH_AUTH_SOCK` allowlisted, so native git over ssh can't use the SSH agent, while docker can.

### Nested-call marker

Native commands sometimes call another dispatched shim (for example `ArcanumSplitIssueFinish` runs `arcanum-split-issue/scripts/github.sh`). Inside the container those shims are the image's own copies, and they go through `engine_dispatch.sh` again.

- The container always has `ARCANUM_IN_DOCKER=1`: set as `ENV` in the `runtime` image and passed again by dispatch.
- When `engine_dispatch.sh` sees it, it runs the native implementation directly and never starts a container from inside one (see [Nested-call guard](#nested-call-guard)). The image has no Docker CLI and no socket anyway.
- A nested call runs under `env -i` like any native call, which would drop the marker. So inside the container, `_engine_dispatch_run_native` also forwards the [container infrastructure env](#container-infrastructure-env).

### Fixed env

Set for every container call:

| Variable | Value | Why |
| --- | --- | --- |
| `ARCANUM_IN_DOCKER` | `1` | the [nested-call marker](#nested-call-marker) |
| `ARCANUM_REPO_PATH` | the repo path | as natively |
| `HOME` | `/tmp/arcanum-home` (from the image) | a writable home for `gh`/`git` caches |
| `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>`, `GIT_CONFIG_VALUE_<n>` | `safe.directory=<repo path>`, plus `safe.directory=<git common dir>` for a worktree | git's ownership check on macOS. `remote` commands with an https remote add the credential-helper entries |
| `HOSTNAME` | the container id (set by Docker) | unique lock instance ids |

The image entrypoint adds `LD_PRELOAD`, `NSS_WRAPPER_PASSWD` and `NSS_WRAPPER_GROUP` (see [Runtime user and entrypoint](#runtime-user-and-entrypoint)).

### Container infrastructure env

The variables a nested `env -i` call inside the container keeps, on top of its own allowlist: `ARCANUM_IN_DOCKER`, `HOME`, `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_COUNT` and its `GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` entries, `GIT_SSH_COMMAND`, `SSH_AUTH_SOCK`, `GH_TOKEN`, `GH_HOST`, `GH_ENTERPRISE_TOKEN`, and the passwd-entry variables. Each is forwarded only when set, so a nested call never gains a credential its outer command didn't have.

## Dispatch

The docker branch of `arcanum/_lib/engine_dispatch.sh` (helpers in `arcanum/_lib/engine_dispatch_docker.sh`): when a call goes to a container, how the `docker run` command is assembled, and what happens when Docker is missing or fails.

### Resolution order

Under `engine.mode=docker`, `engine_dispatch` evaluates this table top-down for every call and takes the first matching row:

| # | Condition | Runs | stderr warning |
| --- | --- | --- | --- |
| 1 | `ARCANUM_IN_DOCKER=1` is set (a [nested call](#nested-call-guard) inside the container) | native, directly, in the current container | none |
| 2 | the command's status is `host-only` | native on the host | none (expected, not a fallback) |
| 3 | the command's status is `native` (not docker-ready) | native on the host | `Warning: '<command>' is not docker-ready yet (arcanum/_lib/migration-status.json) — falling back to the native implementation on the host.` |
| 3b | the command's status is `shell` (no native implementation) | `<shell_script>` on the host | `Warning: no native implementation of '<command>' yet (arcanum/_lib/migration-status.json) — falling back to the shell implementation.` |
| 4 | Docker is [unavailable](#docker-availability-check) | native on the host | `Warning: Docker is unavailable (<reason>) — running '<command>' natively on the host. Fix Docker or change engine.mode.` |
| 5 | otherwise (status `docker`, Docker available) | [`docker run`](#docker-run-invocation-shape) | none |

Every fallback prints exactly one warning line on stderr and leaves stdout and the exit code exactly as the implementation that ran produced them. A Docker failure discovered after `docker run` started falls back to row 4 (see [Exit codes and streams](#exit-codes-and-streams)).

The other modes read the same status values but ignore the docker distinction:

| `engine.mode` | `shell` | `native` | `docker` | `host-only` |
| --- | --- | --- | --- | --- |
| `shell` (default) | shell | shell | shell | shell |
| `native` | shell, with a warning | native | native | native |
| `docker` | shell, with the row-3b warning | native on the host, row-3 warning | container | native on the host |

So `native` keeps meaning "has a native implementation": any value other than `shell`.

### Docker-readiness source of truth

`arcanum/_lib/migration-status.json` is the single map dispatch reads, one string value per dispatch command:

| Value | Meaning |
| --- | --- |
| `"shell"` | no native implementation yet; dual entrypoints only |
| `"native"` | a native implementation exists, but the command is not docker-ready |
| `"docker"` | native exists and runs in the container |
| `"host-only"` | native exists, and the command never runs in the container |

A string enum and not an object: the map only answers "which engine may run this". Everything else a container call needs (credentials, extra mounts, path arguments) is declared by the shim next to its env allowlist (see [Per-command declarations](#per-command-declarations)). [Entrypoint Migration Status](entrypoint-migration-status.md) renders the map.

Native-only commands are listed too, with `"native"`, `"docker"` or `"host-only"`, never `"shell"`. Their `--native-only` flag on the shim still says they have no shell twin.

`host-only` commands, and why:

- `arcanum-update-run-update-apply` and `arcanum-update-run-update-check`: they update the host install itself.
- `auto-fix-issue-run-checks`: it runs the target project's own check script, whose toolchain the image doesn't have, and its exit code passes through the child's (see [Exit codes and streams](#exit-codes-and-streams)).
- `next-step-prompt` and `auto-plan-issue-auto-next`: `next-step-prompt` must keep prompting on the host's real `/dev/tty` (see [TTY](#tty)), and `auto-plan-issue-auto-next` calls it.

**Reading rule:** `_engine_dispatch_status <command> <native_only>` prints one of `shell`, `native`, `docker`, `host-only` and always exits 0:

| Map state | Dual entrypoint | Native-only command |
| --- | --- | --- |
| a known string value | that value | that value (`"shell"` reads as `native`) |
| legacy `true` / `false` | `native` / `shell` | `native` |
| missing key, unknown value, missing or malformed file | `shell` | `native` |

The fallbacks are the safest value that can still run. Neither can ever start a container.

**Making a command docker-ready:** in one PR, add its `--needs`/`--path-arg` declarations to the shim, a `docker` callback to its shim-level routing spec, a parity case under `core/spec/docker/` (run locally and reported in the PR), and flip its value to `"docker"` in `migration-status.json`. See [Testing](#testing).

### Per-command declarations

The shim passes `engine_dispatch` a per-command env allowlist and flags in the segment before `--`. Docker adds two flags to that segment, both in the single-token `--flag=value` form:

| Flag | Repeatable | Values | Drives |
| --- | --- | --- | --- |
| `--needs=<tag>[,<tag>...]` | yes | `global-config`, `gitconfig`, `gh`, `remote` | extra mounts and env |
| `--path-arg=<index>:<ro\|rw\|rw-mkdir>` | yes | 1-based index into `<args...>` | argument path mounts |

| Tag | Mounts | Env |
| --- | --- | --- |
| `global-config` | `$CLAUDE_CONFIG_DIR/arcanum-config.json`, `ro`, if it exists ([Global arcanum config](#global-arcanum-config)) | `-e CLAUDE_CONFIG_DIR=<host path>` |
| `gitconfig` | the global git config file, `ro` ([Git and SSH config](#git-and-ssh-config)) | `-e GIT_CONFIG_GLOBAL=<host path>` |
| `gh` | — | `-e GH_TOKEN` (or `GH_HOST` + `GH_ENTERPRISE_TOKEN`), resolved on the host ([gh credentials](#gh-credentials)) |
| `remote` | agent socket and `known_hosts` for an ssh remote ([Git remote access](#git-remote-access)) | `SSH_AUTH_SOCK` + `GIT_SSH_COMMAND`, or `GH_TOKEN` + credential-helper `GIT_CONFIG_*` for https |

Both flags are ignored outside the container path, so they change nothing under `shell` or `native`. `host-only` commands declare neither. The shims' declarations, together with `migration-status.json`, are the lasting source of truth for what each command needs in the container.

#### Argument path declaration

`--path-arg=<index>:<mode>` marks `<args...>[index]` (1-based, counting only the args after `--`, never the repo path `--prepend-repo-path` adds) as a file path. For each declared index present on this call, dispatch resolves the mount on the host:

| Case | Rule |
| --- | --- |
| argument absent, or an empty string | ignored |
| relative path | resolved against the shim's `$PWD`. If it lands outside the repo, the container gets the absolute path in its argv instead |
| inside `$REPO_PATH` | nothing extra, the repo is already mounted |
| outside the repo, `ro` | the file itself, at the same path, `:ro`. Missing file: not mounted, and the command fails the way it would natively |
| outside the repo, `rw` | the parent directory, at the same path, `rw`. Missing parent: not mounted, same failure as natively |
| outside the repo, `rw-mkdir` | like `rw`, but a missing parent is created on the host (`mkdir -p`) first, for writers that create the parent natively (`permission-grant-add`, `init-claude-write-label-config-*`). If `mkdir -p` fails, nothing is mounted |

Mount sources that are the same path or nested in one another are collapsed into one `-v` (an `rw` parent wins over an `ro` file under it). Only positional path arguments exist; a future option-style path gets a sibling flag when it appears.

### `docker run` invocation shape

A full call for `github-issue-create` (`--needs=global-config,gitconfig,gh --path-arg=3:ro`, a worktree repo, a body file in the scratchpad). Annotated, not runnable as is:

```bash
docker run \
  --rm -i \                                        # always; never -t (see TTY)
  --init \                                         # signal forwarding, see Concurrency
  --label arcanum.dispatch=1 \                     # find stray containers, see Concurrency
  --user "$(id -u):$(id -g)" \                     # File ownership
  --read-only --tmpfs /tmp:rw,exec,mode=1777 \     # HOME=/tmp/arcanum-home, scratch space
  --cap-drop ALL --security-opt no-new-privileges \
  -w "$REPO_PATH" \
  -v "$REPO_PATH:$REPO_PATH" \                     # always
  -v "$COMMON_DIR:$COMMON_DIR" \                   # worktrees only
  -v "$LOG_DIR:$LOG_DIR" \                         # when engine.log.location is set, outside the repo
  -v "$CLAUDE_CONFIG_DIR/arcanum-config.json:$CLAUDE_CONFIG_DIR/arcanum-config.json:ro" \  # --needs=global-config
  -v "$GIT_GLOBAL:$GIT_GLOBAL:ro" \                # --needs=gitconfig
  -v "$BODY_FILE:$BODY_FILE:ro" \                  # --path-arg=3:ro
  -e ARCANUM_IN_DOCKER=1 -e ARCANUM_REPO_PATH \    # fixed env
  -e GIT_CONFIG_COUNT -e GIT_CONFIG_KEY_0 -e GIT_CONFIG_VALUE_0 -e GIT_CONFIG_KEY_1 -e GIT_CONFIG_VALUE_1 \
  -e CLAUDE_CONFIG_DIR -e GIT_CONFIG_GLOBAL -e GH_TOKEN \   # from --needs
  -e <each allowlisted name that is set, except HOME and PATH> \
  darthjee/arcanum:<version> \                     # Distribution and versioning
  github-issue-create "$REPO_PATH" "$TITLE" "$BODY_FILE"
```

Every `-e` carries a name only; dispatch exports the values in its own process first. The image entrypoint `exec`s `/opt/arcanum/core/bin/arcanum`, so the arguments after the image are exactly what `_engine_dispatch_run_native` passes natively: the command, the repo path when `--prepend-repo-path` is given, then `<args...>`.

Where each piece comes from:

- **Fixed for every call:** `--rm -i --init --label`, `--user`, `--read-only`/`--tmpfs`, the capability flags, `-w`, the repo mount, the fixed env.
- **From the repo and config:** the git common dir (worktrees), the log directory, the `safe.directory` entries.
- **From the shim's declarations:** the `--needs` mounts and env, the `--path-arg` mounts, the env allowlist.
- **From the install:** the image tag, resolved once per call (see [Distribution and versioning](#distribution-and-versioning)). The resolved reference sits in a variable of the sourced library, which the parity specs override.

The root filesystem is read-only: everything the command may write is a mount or the tmpfs `/tmp`. No `--network` flag: the default bridge network is needed for `gh` and git remotes.

### Per-call `docker run`, and when to revisit it

Per-call `docker run` is the design. A long-lived container with `docker exec` would save startup time, but its mounts and env are fixed when it is created, while every call needs its own path-argument mounts, credentials and allowlist. It would also share `/tmp` and `HOME` between calls and need a lifecycle owner.

`make docker-benchmark` (`scripts/docker_benchmark.sh`, `--cold` for the single cold run) measures the cost: native on the host against `docker run`, 20 warm runs per command plus one cold run, median and p95 wall time, over `issue-state get`, `resolve-plan-paths`, `auto-fix-all-config-get` and `github-issue-info`, on Linux and macOS Docker Desktop. The first numbers are recorded in [#741](https://github.com/darthjee/arcanum/issues/741)'s PR.

**Threshold:** per-call `docker run` stays while the warm median overhead is at most 1s on Linux and at most 2s on macOS. Above either, a `docker exec` alternative gets designed in its own issue.

### Docker availability check

Run once per call, before row 5 of the resolution table, in order. The first failure is the `<reason>` in the row-4 warning:

1. `command -v docker`: reason `docker not found`.
2. `docker image inspect --format '{{.Id}}' <ref>`: covers both the daemon and the image. A daemon error gives reason `daemon not reachable`.
3. Image missing: pull, then local build (see [Distribution and versioning](#distribution-and-versioning)). Dispatch prints `Info: pulling darthjee/arcanum:<version> (first docker call for this version)…` (or `building`) on stderr, never on stdout. The pull or build runs under a lock in `${XDG_CACHE_HOME:-$HOME/.cache}/arcanum/image.lock`, so concurrent first calls don't race. Both failing gives reason `image darthjee/arcanum:<version> unavailable`.

There is no cross-call cache: every shim call is its own process, and a cache file could go stale.

### Native-only commands

A native-only command follows the same [resolution order](#resolution-order) using its `migration-status.json` entry, minus row 3b: not docker-ready means native on the host, Docker unavailable means native on the host. It never runs a shell script.

### Exit codes and streams

- **Exit code:** `engine_dispatch` returns the `docker run` exit code, which is the container command's own exit code, unchanged, including `3`, `4` (`FALLBACK=chat`) and 128+n for a signal.
- **Streams:** no `-t`, so stdout and stderr stay separate streams, byte for byte. `-i` attaches stdin, for the commands that read it.
- **Docker's own failures:** `docker run` exits `125` when the daemon can't create or start the container, `126` when the entrypoint can't be invoked, and `127` when it isn't found. In all three no arcanum code ran, so dispatch falls back to native on the host with the row-4 warning (reason `docker run failed with <code>`), passing Docker's own stderr through above the warning. The command runs exactly once.

This works because the native CLI never exits `125`–`127` itself: `core/bin/arcanum` maps a `DispatchFailure` exit code in that range to `1`, a contract covered by a spec. A command whose exit code passes through a child's must stay `host-only` or map these codes too.

### Nested-call guard

- **Where:** the very first thing in `engine_dispatch`, after parsing its own flags and before `config_chain_read`. If `ARCANUM_IN_DOCKER=1`, it runs the native implementation and returns. It never reads `engine.mode`, never runs the availability check, never starts a container.
- **Status inside the container:** every command whose status is not `shell` runs native there, including `native`, native-only and `host-only` commands (against the image's copy). No native command calls a `host-only` shim; one that ever does must be `host-only` itself.
- **No native implementation:** a nested `shell` command runs its shell script inside the container, which has `bash`, `jq`, `git` and `gh`.
- **Env:** inside the container, `_engine_dispatch_run_native` forwards the [container infrastructure env](#container-infrastructure-env) on top of the command's own allowlist. On the host it forwards nothing extra.

### TTY

No TTY in the container, ever. Dispatch never passes `-t`, and the container has no `/dev/tty`.

The dispatched commands that open `/dev/tty` through `core/lib/utils/io/TtyPrompt.js` are `arcanum-create-issue-start` and `arcanum-create-issue-publish` (both native-only, docker-ready). Under docker any call that would prompt takes their exit-4 `FALLBACK=chat` path, which `arcanum-create-issue` handles with `AskUserQuestion`: `start` with drafts present and neither `--new` nor `--resume`, and `publish` without `--confirmed` / `--shipit-confirmed`. Calls that pass those flags never open `/dev/tty` and behave as natively.

`next-step-prompt` (`next_step_prompt.sh`) also owns `/dev/tty`, but must keep prompting on the host's real terminal, or every next-step offer would turn into the chat fallback. It and its caller `auto-plan-issue-auto-next` (`auto_next.sh`) are `"host-only"`, so they always run native on the host (row 2 of the [resolution order](#resolution-order)).

### Scripts not routed through dispatch

Some scripts under `<skill>/scripts/` and `arcanum/_lib/` never call `engine_dispatch.sh`, so the docker path does not cover them, and none can ever be docker-ready. Each falls into one kind:

| Kind | Under `engine.mode=docker` |
| --- | --- |
| `sourced` | A library that is only ever `source`d. It runs wherever its caller runs. Inside the container the native implementation runs, so these shell libraries are never used there. |
| `wrapper` | A per-skill script that `exec`s a dispatched `arcanum/_lib` shim. It is covered by that shim's routing. |
| `bootstrap` | The install/update bootstraps. They run before or outside an installed arcanum, so they can never be dispatched. |

A script called directly by skills that needs the docker treatment must become a dispatched command instead (as `next_step_prompt.sh` and `auto_next.sh` did in [#760](https://github.com/darthjee/arcanum/issues/760)).

### Concurrency

- **No fixed names:** dispatch never passes `--name`, so concurrent calls (parallel agents, `auto-fix-all` loops) can't collide.
- **Cleanup:** `--rm` on every call removes the container when it exits.
- **Interrupts:** without `-t`, the `docker run` client proxies the signals it receives (`--sig-proxy`, on by default), and `--init` runs a minimal init as PID 1, which forwards them and reaps children. Ctrl-C or a killed skill stops the container, and `--rm` removes it.
- **Hard kills:** if the `docker run` client is killed with `SIGKILL`, the container keeps running until its command finishes, then `--rm` removes it. The `arcanum.dispatch=1` label lets a user list or remove such containers (`docker ps --filter label=arcanum.dispatch=1`). There is no automatic reaper.
- **Locks:** host and container processes share the same lock files through the repo mount (see [Shared state and locks](#shared-state-and-locks)).

## Testing

| Layer | What it proves | Where it runs | Needs Docker |
| --- | --- | --- | --- |
| [Routing specs](#routing-specs-ci) | dispatch picks the right engine, builds the right `docker run` argv, and passes exit codes and streams through | CircleCI `test` job, and `make core-test` | no, `docker` is faked |
| [Parity specs](#parity-specs-local-only) | a real container produces the same output, exit code and files as native on the host | locally, `make docker-parity` | yes |
| Manual checks | macOS Docker Desktop specifics: file-sharing ownership, the SSH agent proxy, per-call cost | by the PR author, noted in the PR | yes |

### Routing specs (CI)

Jasmine specs under `core/spec/bin/`, picked up by the `bin/**/*_spec.js` glob in `core/spec/support/jasmine.json`, so they run in the CircleCI `test` job (`yarn test`).

#### Fake `docker`

`core/spec/support/utils/fakeDockerBin.js`, built like `fakeGhBin.js`, writes an executable `docker` into a temp dir that the spec puts first on `PATH`. Its behavior is baked into the bin dir at build time. It:

- appends every invocation's argv (one JSON array per line) and the values of the `-e` names it was given to a log file the spec reads back;
- answers `image inspect`, `pull` and `build` with configurable exit codes and stderr;
- answers `run` either **scripted** (configured stdout/stderr and exit code, including 3, 4 and 125–127) or **passthrough** (runs `core/bin/arcanum` on the host with the argv after the image reference and only the `-e` env, then exits with its code).

"Docker unavailable" by missing binary is a `PATH` with no `docker` on it.

#### Dispatch-level specs

`core/spec/bin/engineDispatchDocker_spec.js` drives `engine_dispatch` itself through a `bash -c` wrapper that sources `arcanum/_lib/engine_dispatch.sh`, points `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` at a fixture map, and calls `engine_dispatch` with a fixture command (`dispatch-fixture-crash`, `auto-fix-all-config-get`). Production code never needs an env override: only the sourced variable changes. Cases assert stdout, stderr (including the exact warning line), exit code and the fake's argv log, covering every row of the [resolution order](#resolution-order), the other modes, the reading rule, native-only calls, the full argv (including the worktree, log and `--needs` mounts and env), path arguments, exit codes and streams (including the 125–127 fallback), image acquisition and the nested guard.

#### Shim-level specs

`core/spec/support/sharedExamples/engineDispatchRouting.js`'s `itRoutesEngineDispatch` takes an optional `docker` callback. When given, it adds a case that seeds `engine.mode=docker` and puts a passthrough fake `docker` first on `PATH`. Every docker-ready command passes one, proving its real shim reaches `docker run` with the mounts and env its `--needs`/`--path-arg` declarations imply.

A spec on `core/bin/arcanum` asserts that a `DispatchFailure` with an exit code in 125–127 exits `1` (see [Exit codes and streams](#exit-codes-and-streams)). `arcanum/_lib/test_engine_dispatch.sh` stays a standalone smoke script; CI doesn't run it.

### Parity specs (local only)

Real container against native on the host, for the same command and inputs. For each case stdout is byte-identical (no path rewriting, see [Path identity](#path-identity)), the exit code is the same, and the same files are created or changed with the same content.

- **Location:** `core/spec/docker/**/*_spec.js`, outside the default `jasmine.json` globs, with its own config `core/spec/support/jasmine-docker.json` (`yarn test:docker`). `yarn test` never picks them up.
- **Make target:** `make docker-parity` builds the `runtime` target as `darthjee/arcanum:local-test` and runs the parity config with node on the **host**, since the specs need the host's Docker CLI.
- **Image under test:** the specs set the image tag through the same `bash -c` wrapper as the dispatch-level specs (a sourced variable), so they never pull a published image.
- **Fixtures:** `createGitFixtureRepo` (with a worktree variant), the per-command parity setups under `core/spec/support/factories/`, and `tempDir.js` for argument paths outside the repo.
- **Git remotes:** the git remote cases (`core/spec/docker/gitRemote_spec.js`, through `itMatchesNativeInDockerWithRemote` in `core/spec/support/factories/dockerRemoteParitySetup.js`) need no credentials. The fixture's `origin` is a bare repo inside its own git common dir (a `file://` URL), reached through the repo or git common dir mount, so every run compares real fetch and push behavior. Each case also compares the origin's branches after each run (`runDockerParity`'s `inspect` hook). Commands that commit mask commit hashes before comparing. The commit identity comes from the world's `HOME/.gitconfig`, through the `gitconfig` need.
- **TTY-owning commands:** `runDockerParity` (and `itMatchesNativeInDocker`) take `detachNative: true`: the native side runs in a new session with no controlling terminal (`spawn(..., { detached: true })`) and stdin from `/dev/null`, so both sides take the exit-4 path. The `arcanum-create-issue` cases (`core/spec/docker/arcanumCreateIssue_spec.js`) use it, with a fake `gh` natively and a fake `GH_TOKEN` in the container so start's GitHub preflight passes offline. `publish`'s success path has no case, because it would create a real GitHub issue.

#### Credentials

Cases that need `gh` or a real ssh remote are opt-in. They run only when `ARCANUM_DOCKER_PARITY_GH=1` or `ARCANUM_DOCKER_PARITY_SSH=1` is set, and are marked pending otherwise. A fake GitHub API can't reach into the container, and fake `gh` binaries don't help since the image has its own `gh`, so these are the only way to check the gh/ssh wiring for real.

The gh cases run against a sandbox repo on github.com named by env, never hardcoded. When `ARCANUM_DOCKER_PARITY_GH=1` is set but a variable a case needs is missing or malformed, that case is pending with a message naming it, never failed:

- `ARCANUM_DOCKER_PARITY_GH_REPO=<owner>/<repo>`: the sandbox repo, needed by every gh case. The fixture's `origin` points at `https://github.com/<owner>/<repo>.git`. It can be private: `git fetch` gets the gh credential helper through the `remote` need. The token needs read access (plus issue write access for the label-mutation cases).
- `ARCANUM_DOCKER_PARITY_GH_ISSUE=<n>`: an open fixture issue. The label-mutation cases snapshot its labels, restore them before each run and again at the end.
- `ARCANUM_DOCKER_PARITY_GH_PR=<n>`: an open fixture pull request, for the PR lookups.
- `ARCANUM_DOCKER_PARITY_GH_PR_BRANCH=<branch>`: that PR's head branch, for the lookups that resolve the PR from the current branch.

The token comes from the host (`GH_TOKEN`, `GITHUB_TOKEN` or `gh auth token`), so the gh cases keep this machine's real `HOME`, with `CLAUDE_CONFIG_DIR` still isolated. When the global gitconfig sets `user.ghuser`, native's `Warning: gh auth switch --user <x> failed; …` line shows up only on the docker run's stderr, and the gh cases drop it before comparing.

Example: `ARCANUM_DOCKER_PARITY_GH=1 ARCANUM_DOCKER_PARITY_GH_REPO=<owner>/<repo> ARCANUM_DOCKER_PARITY_GH_ISSUE=<n> ARCANUM_DOCKER_PARITY_GH_PR=<n> ARCANUM_DOCKER_PARITY_GH_PR_BRANCH=<branch> make docker-parity`.

The ssh cases also need `ARCANUM_DOCKER_PARITY_SSH_REMOTE=<git@host:owner/repo.git>` (or an `ssh://` URL): a remote they only fetch from, with a `main` branch. Both runs keep this machine's real `HOME` and `SSH_AUTH_SOCK`. The native run never gets `SSH_AUTH_SOCK` (no shim allowlists it), so the case passes only when the host's ssh can authenticate without the agent; otherwise it reports the divergence described in [Git remote access](#git-remote-access).

Example: `ARCANUM_DOCKER_PARITY_SSH=1 ARCANUM_DOCKER_PARITY_SSH_REMOTE=git@github.com:<owner>/<repo>.git make docker-parity`.

### Not in CI, and why

- CircleCI's `setup_remote_docker` runs the daemon on a separate remote host, so bind mounts refer to that host's filesystem, not the job's checkout, and the [path-identity](#path-identity) mounts can't work.
- A machine executor job could run Docker locally, but it is slower, costs more, and means a second job definition for one feature.

The remaining risk is drift between the `runtime` image and the code (a missing tool, a wrong path in the baked install), caught only by whoever runs `make docker-parity`. It is mitigated by the shared `base` stage, by the routing specs' passthrough mode, and by the rule that no command becomes `"docker"` without a local parity run.

## See also

- [Script Engine](script-engine.md): `engine.mode`, the shell/native dispatch and its fallbacks.
- [Entrypoint Migration Status](entrypoint-migration-status.md): every dispatch command's `migration-status.json` value.
- [Shared State and Configuration](shared-state-and-configuration.md): where `engine.mode` and `engine.log.location` are configured.
- [Install and Release](install-and-release.md): the release flow that publishes the runtime image.

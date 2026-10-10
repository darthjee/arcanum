# Docker Engine: Mounts

Part of the [Docker Engine spec](../docker.md) (epic #724). Written in #726, implemented in #729.

This part defines what the container can see of the host filesystem. Every rule follows the [Security principles](../docker.md#security-principles): the minimum, `ro` unless the command writes there, never a private key, never the Docker socket.

## Path identity

**Every mount uses the same absolute path inside the container as on the host.** Commands print paths (`FILE=…`, `ISSUE_FILE=…`, `PLAN_DIR=…`) that skills then use on the host, take absolute paths as arguments, and read paths stored in files (a worktree's `.git` file holds an absolute `gitdir:`). With identical paths, none of that needs translating.

## Mounts

| Mount | Host path | Mode | When | Why |
| --- | --- | --- | --- | --- |
| Repo | `$REPO_PATH` | `rw` | always, with `-w "$REPO_PATH"` | the target repo, including `.claude/state/` (queues, issue state, their locks) and `.claude/configuration/` |
| Git common dir | `git -C "$REPO_PATH" rev-parse --path-format=absolute --git-common-dir` | `rw` | only when `$REPO_PATH/.git` is a file (a worktree) | refs, objects and `worktrees/<name>/` live there; git writes to it on every commit, fetch and checkout |
| Global arcanum config | `$CLAUDE_CONFIG_DIR/arcanum-config.json` | `ro` | rows tagged `global-config:ro`, and only when the file exists | the global tier of the config chain |
| Log location | the resolved `engine.log.location` directory | `rw` | every row, when `engine.log.location` is set | `InvocationLog` appends `arcanum-<repo>-log.txt` there on every call |
| Git global config | the host's global git config file | `ro` | rows tagged `gitconfig:ro` | commit identity, `user.ghuser`, aliases and other user settings |
| `known_hosts` | `~/.ssh/known_hosts` | `ro` | rows tagged `remote`, ssh remotes only | host-key checking for `git` over SSH |
| SSH agent socket | see [environment.md](environment.md#git-remote-access) | — | rows tagged `remote`, ssh remotes only | SSH auth without keys in the container |
| Argument paths | absolute path arguments outside the repo | `ro` or `rw` | rows tagged `args:ro`/`args:rw` | body files in the scratchpad or `/tmp`, an output file, a settings file |

Not mounted, ever:

- **The arcanum install.** The image carries its own copy of the install, at the same version (see [image.md](image.md#what-the-runtime-target-bakes-in)). Native code resolves templates, `config_chain.sh` and sibling shims from that copy, so the host install is never needed.
- **The rest of `CLAUDE_CONFIG_DIR`.** It holds Claude Code credentials, session transcripts and other projects' settings. No native command reads anything there except `arcanum-config.json` (`ConfigChain`). A command that writes a Claude settings file there (`permission-grant-add` against the global `settings.json`) gets only that file, through `args:rw`.
- **Host `/tmp` or the scratchpad as a whole.** Native commands that need scratch space (`ArcanumSplitIssueCreateSubIssue`'s `mkdtemp`) use the container's own tmpfs `/tmp`. Files a skill hands over are mounted one by one as argument paths.
- **`~/.ssh` private keys, `~/.config/gh`, the Docker socket.** See [environment.md](environment.md) for how credentials reach the container instead.

### Repo and worktrees

`-v "$REPO_PATH:$REPO_PATH" -w "$REPO_PATH"`, `rw`, for every command. Commands also use `$PWD` as their repo path in a few shims (`monitor-issues/scripts/config.sh`, `rewrite_queue.sh`), which is why the working directory is the repo too.

When the repo is a git worktree, `$REPO_PATH/.git` is a file containing `gitdir: <common dir>/worktrees/<name>`. Dispatch resolves the common dir on the host and mounts it at the same path, `rw`. Without it, every git command in the container fails with `not a git repository`. Only the common dir is mounted. Sibling worktrees are not, even though the common dir's `worktrees/` metadata lists them.

### Global arcanum config

Dispatch resolves the config dir on the host (`CLAUDE_CONFIG_DIR`, or else `$HOME/.claude`) and passes it to the container as `-e CLAUDE_CONFIG_DIR=<host path>`, because the container's `HOME` is synthetic and `ConfigChain` would otherwise look under `/tmp/arcanum-home/.claude`. Only the `arcanum-config.json` file under it is mounted, at the same path, `ro`. If it does not exist, nothing is mounted and the global tier reads as empty, as it does natively.

No native command writes the global arcanum config. The `auto-fix-all-config-*`, `monitor-issues-config-*` and queue writers all write under the repo's `.claude/`. So there is no `rw` variant.

This applies only to rows whose native allowlist already carries `HOME` or `CLAUDE_CONFIG_DIR`. A command run natively without either never sees the global tier, and docker keeps that parity.

### Shared state and locks

All shared JSON state that commands mutate lives under the repo's `.claude/state/` (`auto-fix-all-queue.json`, `monitor-issues-rewrite-queue.json`, `issue-<id>.json`, `arcanum-config.json`, …). `arcanum/_lib/lock.sh` and `core/lib/utils/file/Lock.js` put the `LOCK_FILE` next to the state file. The repo mount is `rw` at the same path, so a host process and a container process see the same lock file and exclude each other.

The lock protocol writes a `${HOSTNAME}-<pid>-<time>` instance id and reads it back. Each container gets its own hostname (its container id), and the time component is per call, so ids stay unique across the host and any number of concurrent containers even though container pids restart at 1.

### Log location

`InvocationLog` runs for every command and appends to `<engine.log.location>/arcanum-<repo>-log.txt` when that key is set. Dispatch resolves the key on the host with `config_chain_read "$REPO_PATH" engine log.location`, and mounts that directory `rw` at the same path when it is set and outside the repo. Logging failures are swallowed natively, so a location that can't be mounted only loses the log line.

### Git and SSH config

- **Global git config:** dispatch resolves the host's global config file (`$GIT_CONFIG_GLOBAL`, else `~/.gitconfig`, else `${XDG_CONFIG_HOME:-~/.config}/git/config`), mounts it `ro` at the same path, and points `GIT_CONFIG_GLOBAL` at it (see [environment.md](environment.md#home-and-the-allowlist)). `[include]` and `[includeIf]` targets are not mounted. Settings that live only in an included file don't apply in the container. That is a known limitation (see [Known limitations](#known-limitations)).
- **`known_hosts`:** `~/.ssh/known_hosts` `ro`, at the same path, used through `GIT_SSH_COMMAND` (see [environment.md](environment.md#git-remote-access)). Only for `remote` rows with an ssh remote.
- **Never** `~/.ssh` itself, `id_*` keys or `~/.ssh/config`.

### Argument paths

Some commands take a file path argument that may point outside the repo: a body file in the session scratchpad, an output file, a Claude settings file. Each such argument is mounted on its own, at the same path:

- `args:ro`: an input file. The file itself is mounted.
- `args:rw`: a file the command writes or creates. Its parent directory is mounted, because the file may not exist yet.

Paths inside the repo need nothing extra. Which arguments of a command are paths is the shim's knowledge. The shim declares them with `--path-arg=<index>:<ro|rw>` (see [dispatch.md](dispatch.md#argument-path-declaration)).

## File ownership

Dispatch always passes `--user "$(id -u):$(id -g)"`. The container never runs as root, so it can't create root-owned files in the user's repo, and `core/docker-entrypoint.sh`'s `chown` never runs against it.

- **Linux:** bind mounts pass uids through unchanged. Files the container creates in the repo, the git common dir or the log directory are owned by the host user. The container uid also owns the repo, so git's ownership check passes on its own.
- **macOS Docker Desktop:** the file-sharing layer (virtiofs or gRPC FUSE) creates files on the host as the host user, whatever uid the container uses. Inside the container, mounted files may show a different owner than the container uid. Dispatch therefore sets `safe.directory` explicitly for the repo and git common dir (see [image.md](image.md#runtime-user-and-entrypoint)). Mounted paths must be inside Docker Desktop's shared directories.

## Deriving the checklist `mounts` column

For each row of [checklist.md](checklist.md):

1. **Repo:** implicit, never listed. The git common dir (worktrees) and the log location are implicit too, since they depend on the repo and config, not on the command.
2. **`global-config:ro`:** when the command's `engine_dispatch` allowlist includes `HOME` or `CLAUDE_CONFIG_DIR`.
3. **`gitconfig:ro`:** when `credentials` includes `gh` or `git-push (ssh)`. That is broader than the native allowlist for `checkout-safe-branch` and `auto-fix-all-checkout-from-main`, which have no `HOME` today: their merges need the user's commit identity.
4. **`remote`:** when `credentials` includes `git-push (ssh)`. That means `known_hosts:ro` and the agent socket for an ssh remote, or nothing extra for an https remote (the token goes through env).
5. **`args:ro`/`args:rw`:** when the command takes a path argument that may sit outside the repo.
6. **`host-only`:** the command never runs in the container (see the row's notes). The other columns don't apply.

## Known limitations

These follow from the mounts above. #729 decides whether each one makes a command fall back to native:

- **Commit signing:** a repo or user with `commit.gpgsign=true` needs the signing agent (GPG or SSH signing), which is not forwarded. Commands that commit would fail in the container.
- **Git hooks:** `pre-commit`/`commit-msg` hooks run inside the container and only find tools the image has.
- **Included git config:** settings coming only from `[include]`/`[includeIf]` files are missing.

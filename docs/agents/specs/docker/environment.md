# Docker Engine: Environment

Part of the [Docker Engine spec](../docker.md) (epic #724). Written in #726, implemented in #729.

This part defines which env vars reach the container, how credentials get there, and how a call made from inside the container avoids starting another one. Everything follows the [Security principles](../docker.md#security-principles): no token in the image, none in argv, and only for the commands whose checklist `credentials` cell needs it.

## Allowlist mapping

Natively, `_engine_dispatch_run_native` runs `core/bin/arcanum` under `env -i`, with `PATH`, `ARCANUM_REPO_PATH` and the command's own allowlist of env var **names**, each forwarded only when set. Under docker the same allowlist becomes `docker run` flags:

- Each allowlisted name that is set in the dispatching process becomes `-e NAME`, with no `=value`. Docker reads the value from the dispatching process's own env, so it never appears in argv or `ps`. Names that are not set are skipped, as natively.
- `PATH` is **not** forwarded. The image has its own `PATH`, and host paths mean nothing in the container.
- `ARCANUM_REPO_PATH` is always set, to the repo path, which is the same inside and out (see [mounts.md](mounts.md#path-identity)).
- `HOME` gets special treatment, below.

Nothing else from the host env reaches the container, except the variables this page adds explicitly.

## `HOME` and the allowlist

Most allowlists carry `HOME` because natively it is a proxy: `gh` finds its auth through it, git finds `~/.gitconfig` through it, and `ConfigChain` finds `~/.claude/arcanum-config.json` through it. Forwarding the host's `HOME` value into the container would point at a directory that is not mounted, so under docker:

- A `HOME` entry in the allowlist is **not** forwarded. The container keeps the image's synthetic, writable `HOME` (`/tmp/arcanum-home`, see [image.md](image.md#runtime-user-and-entrypoint)).
- What `HOME` stood for arrives explicitly instead:

| Natively through `HOME` | Under docker |
| --- | --- |
| `~/.claude/arcanum-config.json` | `-e CLAUDE_CONFIG_DIR=<host path>` plus the `global-config:ro` mount |
| `~/.gitconfig` | `-e GIT_CONFIG_GLOBAL=<host path>` plus the `gitconfig:ro` mount |
| `~/.ssh/known_hosts` | the `known_hosts:ro` mount, used through `GIT_SSH_COMMAND` |
| `gh` auth under `~/.config/gh` or the keychain | `-e GH_TOKEN` |

`GIT_CONFIG_GLOBAL` makes git read exactly the mounted file as its global config, whatever `HOME` is, with no symlink or copy into the synthetic `HOME`.

## gh credentials

For commands whose `credentials` cell includes `gh` (and `remote` commands with an https remote, below), dispatch resolves a token **on the host** and passes it by env:

1. If `GH_TOKEN` or `GITHUB_TOKEN` is already set in the dispatching process, use it.
2. Otherwise run `gh auth token --hostname <host>` on the host, where `<host>` is the domain `arcanum/_lib/origin.sh` resolves from the repo's remote. When `user.ghuser` is set in git config, add `--user <ghuser>`, which replaces the `gh auth switch --user` that `GithubToken` does natively. Inside the container, `gh auth switch` has no config to switch, only warns, and never fails the command.
3. Put the result in the dispatching process's env and pass it as `-e GH_TOKEN`. It never goes in argv.

Rules:

- `~/.config/gh` is **never** mounted. On macOS the token lives in the keychain anyway, and the hosts file may list accounts the command must not use.
- **GitHub Enterprise:** when the resolved host is not `github.com`, dispatch sets `-e GH_HOST=<host>` and passes the token as `-e GH_ENTERPRISE_TOKEN` instead of `GH_TOKEN`, which is how `gh` picks the token for a non-github.com host.
- **No token:** if no token can be obtained, the command still runs without one and fails the way it would natively (`gh` reports it is not authenticated). Dispatch never prompts.
- The token lives only in the dispatching process's env and the container's env for the length of one call.

## Git remote access

Rows with `git-push (ssh)` in `credentials` (any `fetch`, `push` or `pull` against the remote) are tagged `remote` in the checklist. Dispatch reads the remote URL on the host (`origin.sh`) and picks the transport:

**ssh remote:** forward the host's SSH agent, never a key.

- **Linux:** `-v "$SSH_AUTH_SOCK:/run/arcanum/ssh-agent.sock" -e SSH_AUTH_SOCK=/run/arcanum/ssh-agent.sock`. The socket is mounted at a fixed path because the host's socket path usually sits under a per-session temp directory.
- **macOS Docker Desktop:** `-v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock -e SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock`. This is Docker Desktop's built-in proxy to the macOS agent. The host's own `SSH_AUTH_SOCK` path can't be mounted into the VM.
- `known_hosts:ro` is mounted, and `GIT_SSH_COMMAND="ssh -o UserKnownHostsFile=<host known_hosts path> -o StrictHostKeyChecking=yes"` makes ssh use it. A host key that isn't already known fails, as it should. The container never adds one.
- **No agent:** when `SSH_AUTH_SOCK` is unset (Linux) or the agent has no keys, the command runs anyway and git fails the way it would natively.
- ssh needs a passwd entry for the uid. That is the image's job (see [image.md](image.md#runtime-user-and-entrypoint)).

**https remote:** git authenticates with the gh token. Dispatch passes `GH_TOKEN` (as above) and points git's credential helper at gh through `GIT_CONFIG_COUNT` env: first an empty `credential.helper`, which clears any host helper such as `osxkeychain` that doesn't exist in the container, then `credential.helper=!gh auth git-credential`. This is what `gh auth setup-git` would write, without writing any file. #728/#729 may move it into the entrypoint instead, but it must not need a writable git config.

## Nested-call marker

Native commands sometimes call another dispatched shim (for example `ArcanumSplitIssueFinish` runs `arcanum-split-issue/scripts/github.sh`, and `AutoFixAllReplyComment` runs `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`). Inside the container those shims are the image's own copies, and they go through `engine_dispatch.sh` again.

- The container always has `ARCANUM_IN_DOCKER=1`: set as `ENV` in the `runtime` image and passed again by dispatch.
- When `engine_dispatch.sh` sees `ARCANUM_IN_DOCKER=1`, it runs the native implementation directly, whatever `engine.mode` says, and never starts a container from inside one. The image has no Docker CLI and no socket, so it couldn't anyway. That rule is what keeps it fast and correct.
- A nested call runs under `env -i` like any native call, which would drop the marker and everything else on this page. So inside the container, `_engine_dispatch_run_native` also forwards the [container infrastructure env](#container-infrastructure-env) on top of the command's own allowlist.

The dispatch-side mechanics (where the check sits, and what happens to native-only and not-yet-docker-ready commands nested inside the container) are in [dispatch.md](dispatch.md#nested-call-guard).

## Fixed env

Set for every row, never listed in the checklist:

| Variable | Value | Why |
| --- | --- | --- |
| `ARCANUM_IN_DOCKER` | `1` | the [nested-call marker](#nested-call-marker) |
| `ARCANUM_REPO_PATH` | the repo path | as natively |
| `HOME` | `/tmp/arcanum-home` (from the image) | a writable home for `gh`/`git` caches |
| `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_<n>`, `GIT_CONFIG_VALUE_<n>` | `safe.directory=<repo path>`, plus `safe.directory=<git common dir>` for a worktree | git's ownership check on macOS (see [mounts.md](mounts.md#file-ownership)). `remote` rows with an https remote add the credential-helper entries above |
| `HOSTNAME` | the container id (set by Docker) | unique lock instance ids (see [mounts.md](mounts.md#shared-state-and-locks)) |

The passwd-entry mechanism may add its own variables (for example `LD_PRELOAD`, `NSS_WRAPPER_PASSWD`, `NSS_WRAPPER_GROUP`). Those are set by the image entrypoint, not by dispatch.

## Container infrastructure env

The variables a nested `env -i` call inside the container must keep, on top of its own allowlist: `ARCANUM_IN_DOCKER`, `HOME`, `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_COUNT` and its `GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` entries, `GIT_SSH_COMMAND`, `SSH_AUTH_SOCK`, `GH_TOKEN`, `GH_HOST`, `GH_ENTERPRISE_TOKEN`, and the passwd-entry variables. Each is forwarded only when set, so a nested call never gains a credential its outer command didn't have.

## Deriving the checklist `env` column

The `env` column lists only what docker adds beyond the command's existing allowlist (`HOME` dropped, `PATH` not forwarded). The [fixed env](#fixed-env) is implicit for every row and not repeated. For each row of [checklist.md](checklist.md):

1. **`CLAUDE_CONFIG_DIR`:** when the row has `global-config:ro` (unless the allowlist already carries it).
2. **`GIT_CONFIG_GLOBAL`:** when the row has `gitconfig:ro`.
3. **`GH_TOKEN`:** when `credentials` includes `gh`. Read it as `GH_HOST` + `GH_ENTERPRISE_TOKEN` on GitHub Enterprise.
4. **`remote`:** when the row is tagged `remote`. That means `SSH_AUTH_SOCK` and `GIT_SSH_COMMAND` for an ssh remote, or `GH_TOKEN` plus the credential-helper `GIT_CONFIG_*` entries for an https remote.

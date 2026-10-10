# Write environment.md

Replace the stub with the environment spec.

Content:

- **Allowlist mapping:** each name in a command's `engine_dispatch` allowlist becomes `-e NAME`, so Docker reads the value from the dispatching process's env and it never appears in argv or `ps`. A name is forwarded only when it is set, matching `_engine_dispatch_run_native`.
  - `PATH` is never forwarded, because the image has its own.
  - `ARCANUM_REPO_PATH` is always set.
- **`HOME` in the allowlist:** forwarding the host's `HOME` value would point at a path that is not mounted. Under docker, a `HOME` entry in the allowlist is **not** forwarded. The container gets the image's synthetic writable `HOME`, and the files `HOME` was a proxy for reach the container through explicit mounts and env vars instead:
  - `CLAUDE_CONFIG_DIR`, via the explicit env var plus mount;
  - `~/.gitconfig` and `known_hosts`, via `ro` mounts;
  - gh auth, via `GH_TOKEN`.
  - Spell out that `GIT_CONFIG_GLOBAL` (pointing at the mounted gitconfig) is the clean way to make git find it.
- **gh credentials (decided):** for commands whose `credentials` cell includes `gh`:
  - use `GH_TOKEN`/`GITHUB_TOKEN` if set on the host, otherwise run `gh auth token --hostname <host>` on the host, and pass the result as `-e GH_TOKEN`;
  - never mount `~/.config/gh`, because on macOS the token lives in the keychain;
  - on GitHub Enterprise (the domain is resolved from the remote by `arcanum/_lib/origin.sh`), set `GH_HOST` and pass `GH_ENTERPRISE_TOKEN` instead;
  - if no token can be obtained, the command still runs and fails the way native would. Never prompt.
- **Git remote access over SSH:** for `git-push (ssh)` commands, forward the SSH agent, read-only from the container's point of view:
  - Linux: `-v "$SSH_AUTH_SOCK:/ssh-agent" -e SSH_AUTH_SOCK=/ssh-agent`;
  - macOS Docker Desktop: `-v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock -e SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock`;
  - no agent available: the command runs and git fails the way it would natively;
  - HTTPS remotes use `GH_TOKEN` through gh's git credential helper. Note this as a requirement on the image or entrypoint (`gh auth setup-git` or `GIT_CONFIG_*` env), with the details left to #728/#729.
- **Nested-call marker:** the container always has `ARCANUM_IN_DOCKER=1`. When `engine_dispatch.sh` sees it, it runs the native implementation directly and never starts another container. The dispatch-side mechanics live in `dispatch.md` (#727), so link there.
- **Other fixed env:** `HOME` (synthetic), `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL` when mounted, `ARCANUM_IN_DOCKER=1`, plus `HOSTNAME`, which Docker sets on its own.
- **Deriving the checklist `env` column:** list only what is added beyond the allowlist. By the rules above that is `CLAUDE_CONFIG_DIR` (when the config dir is mounted), `GH_TOKEN` (gh), `SSH_AUTH_SOCK` (ssh), and `GIT_CONFIG_GLOBAL` (git). `ARCANUM_IN_DOCKER` is implicit for every row and not repeated.

## Files to Change

- `docs/agents/specs/docker/environment.md` — replace the stub with the full spec above.

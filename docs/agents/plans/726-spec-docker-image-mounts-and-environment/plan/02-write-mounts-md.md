# Write mounts.md

Replace the stub with the mount spec. Each mount gets a row with these columns: host path, container path (always the same absolute path unless stated), `ro`/`rw`, when it applies, and why.

Content:

- **Repo:** `-v "$REPO_PATH:$REPO_PATH"` plus `-w "$REPO_PATH"`, `rw`, always. Keeping the same path is what makes emitted `FILE=…`/`REPO_PATH` values valid for skills on the host.
- **Git common dir (worktrees):** when `$REPO_PATH/.git` is a file, also mount `git -C "$REPO_PATH" rev-parse --path-format=absolute --git-common-dir` at the same path, `rw`. It holds refs, objects and `worktrees/<name>`. Note that the worktree's `.git` file holds an absolute `gitdir:` path, which is why the path must be identical.
- **`CLAUDE_CONFIG_DIR`:** resolve it on the host (`CLAUDE_CONFIG_DIR`, or else `$HOME/.claude`) and mount it at the same path. Pass `CLAUDE_CONFIG_DIR` explicitly, because the container's `HOME` is synthetic and `core/lib/context/ClaudeContext.js` would otherwise fall back to `$HOME/.claude`. It is `rw` only for commands that write global config or shared state (`auto-fix-all-config-*`, the `auto-fix-all-queue-*` writers, `monitor-issues-*` writers, `permission-grant-add`, `init-claude-set-next-step-auto`, and similar), and `ro` otherwise.
- **Arcanum install:** mounted only if the native implementation shells out to shell scripts in the install. Otherwise the baked-in `core/` is enough. `ro`. Since the install usually sits under `CLAUDE_CONFIG_DIR/skills`, document how the two mounts overlap, or how one mount covers both.
- **Shared state and locks:** `arcanum/_lib/lock.sh` puts `LOCK_FILE` next to the state JSON. Host and container processes can share locks only if the state file's directory is mounted `rw` at the same path. The `${HOSTNAME}-$$` instance id stays unique, because each container has its own hostname.
- **Scratchpad and `/tmp`:** decide whether to bind host `/tmp` or the session scratchpad. Recommended: do not mount host `/tmp` wholesale. Mount only paths a command is given as arguments (for example body files passed to `github.sh update`), at the same path, `ro`. Note how dispatch finds them (they are absolute-path arguments) or defer that detail to #727.
- **Git and SSH config:** `~/.gitconfig` `ro` (author identity, aliases) for git-using commands. `~/.ssh/known_hosts` `ro` for `git-push (ssh)` commands. Agent socket details are in `environment.md`. Never mount `~/.ssh` private keys.
- **File ownership:** `--user $(id -u):$(id -g)`, so files written into the repo and the config dir stay owned by the host user. Cover the Linux behavior (uid passthrough) and macOS Docker Desktop (virtiofs maps ownership to the host user regardless).
- **Deriving the checklist `mounts` column:** state the rule: repo implicit; plus `CLAUDE_CONFIG_DIR:ro|rw`; plus `gitconfig:ro`/`known_hosts:ro` according to the credentials column; plus the git common dir, implicit whenever the repo is a worktree.

## Files to Change

- `docs/agents/specs/docker/mounts.md` — replace the stub with the full spec above.

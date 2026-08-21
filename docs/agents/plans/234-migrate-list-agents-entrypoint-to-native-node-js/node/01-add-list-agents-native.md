# Add the native ListAgents implementation

Create `core/lib/ListAgents.js`, following the constructor-injection class shape used by `SafeBranch.js`/`RepoPath.js` (an injectable `deps` object for testability, no module-level singletons).

Behavior (`async run(repoPath, agentsDir = '.claude/agents')`):
1. `await new RepoPath().validate(repoPath)` — throws the same `Error` messages as `repo_path_enter`/`RepoPath.js` on missing/invalid `repoPath`. Do not catch it; let it propagate (matches the shared hard-failure contract other migrated entrypoints use, e.g. `SafeBranch.run`).
2. Resolve `agentsDir` relative to `repoPath` (`path.join`, mirroring the shell's own relative resolution — `agentsDir` itself is never independently validated as a directory before this check, same as the shell version).
3. If the resolved directory doesn't exist, or contains no `*.md` files, return `''` (empty string) — the router only writes stdout for a non-empty/truthy string return, so returning `''` produces the shell's "prints nothing, exit 0" behavior for free.
4. List `*.md` files directly inside the directory (non-recursive, matching the shell's `agents_dir/*.md` glob), sort them alphabetically by filename (`Array.prototype.sort()` on the bare filename, not the full path, to match `sort` on the shell's file list).
5. For each file, in that sorted order: read its content, extract `name` and `description` from the first `---`/`---`-delimited frontmatter block via a per-line regex (`^field:\s*(.*)$`), stripping one layer of surrounding `'...'` or `"..."` quotes from the captured value if present. Skip the file entirely if no `name` was found (no line emitted for it).
6. Join the surviving lines as `name|description\n` and return the joined string (each line newline-terminated, matching `printf '%s|%s\n'`'s per-line behavior).

## Files to Change

- `core/lib/ListAgents.js` — new native implementation described above.

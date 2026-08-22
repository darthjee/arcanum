# Create AutoFixAllCleanupArtifacts.js

Implement `core/lib/AutoFixAllCleanupArtifacts.js`, the native counterpart of `auto-fix-all/scripts/cleanup_artifacts_shell.sh`. A class with a `run(repoPath, issueFile, planDir, id, modelName, modelEmail)` method (mirroring `SafeBranch`/`SpawnIssue`'s constructor-injected-deps shape for testability) that:

1. Validates all 5 args are present — throws (usage message, non-zero exit per the shared hard-failure contract) if any are missing, matching the shell script's `Usage: $0 <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>` string.
2. If `issueFile` is tracked by git (`git ls-files <issueFile>` non-empty), stages its removal (`git rm <issueFile>`).
3. If `planDir` exists on disk AND is tracked by git (`git ls-files <planDir>` non-empty), stages its removal recursively (`git rm -r <planDir>`).
4. If nothing ends up staged (`git diff --cached --quiet` exits 0), returns immediately — empty stdout, exit 0, no commit, no push.
5. Otherwise, commits with the exact hardcoded message (see `plan.md`'s "Shared contracts") via `git commit -F -` (stdin fed the message), then pushes the current branch (`git branch --show-current` then `git push -u origin <branch>:<branch>`) — this is the one piece of `arcanum/_lib/push.sh` logic to re-derive natively (see `node.md`'s Notes).

All `git` calls use `execFile`/`spawn` with an argument array (never a string-interpolated `exec()`), per `script-engine.md`'s security requirements, with `cwd: repoPath`.

## Files to Change

- `core/lib/AutoFixAllCleanupArtifacts.js` — new file

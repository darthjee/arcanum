# Add the ignored_check_patterns read to RepoConfig

`core/lib/RepoConfig.js` currently only covers single-tier reads of the local `.claude/state/arcanum-config.json` (`getSafeBranch`, `getPlanIssuesRetryConfig`). The shell version of `wait_ci.sh` instead reads `ignored_check_patterns` from `.claude/configuration/arcanum-repo-config.json`, namespace `auto-fix-all`, via `arcanum/_lib/repo_config.sh`'s `repo_config_read` — a different file and a namespaced key, not yet covered by `RepoConfig.js`.

Add a new method (e.g. `getIgnoredCheckPatterns(repoPath)`) that reads `.claude/configuration/arcanum-repo-config.json`, namespace `auto-fix-all`, field `ignored_check_patterns`, mirroring the shell script's own read: missing file/field/malformed JSON all resolve to an empty array (`[]`), never throw — same default-on-failure shape as the other `RepoConfig` methods. No legacy `.claude/configuration/auto-fix-all.json` fallback, matching the shell version's documented behavior.

## Files to Change

- `core/lib/RepoConfig.js` — add `getIgnoredCheckPatterns(repoPath)`.

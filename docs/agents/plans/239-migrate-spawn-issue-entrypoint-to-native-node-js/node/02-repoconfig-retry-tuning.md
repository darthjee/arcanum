# Add retry-tuning config reads to RepoConfig

`core/lib/RepoConfig.js` currently exposes only `getSafeBranch(repoPath)`, reading `git.safe_branch` from `.claude/state/arcanum-config.json`. `spawn_issue.sh` reads two more keys from the same file's `plan-issues` section: `max-retry-count` (default 5) and `error-sleep-time` (default 5, seconds).

Add a sibling method, e.g. `getPlanIssuesRetryConfig(repoPath)`, returning `{ maxRetryCount: number, errorSleepTime: number }`. Reuse the same read/parse/default-fallback shape `getSafeBranch` already has (missing file, unreadable, malformed JSON, or a missing/non-numeric key all fall back to the default — never throw). Keep `getSafeBranch` itself unchanged; this is an additive method on the same class, not a rewrite.

## Files to Change
- `core/lib/RepoConfig.js` — add `getPlanIssuesRetryConfig(repoPath)`.
- `core/spec/lib/RepoConfig_spec.js` — extend with cases for the new method: file absent, section absent, keys absent, keys present and numeric/string, malformed JSON.

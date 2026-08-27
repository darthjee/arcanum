# Remove unused RepoConfig.getPlanIssuesRetryConfig

Confirmed (grepped across `core/lib` and `core/bin`) that `RepoConfig#getPlanIssuesRetryConfig` has no consumers besides `SpawnIssue`, which node/04 migrates off it. Remove the method now that it's dead, along with its now-unused `DEFAULT_MAX_RETRY_COUNT`/`DEFAULT_ERROR_SLEEP_TIME` constants and `_numberOrDefault` helper — but only if `_numberOrDefault` isn't still used by `getSafeBranch`/`getIgnoredCheckPatterns` (it currently isn't; double-check before deleting). Do not remove `getSafeBranch` or `getIgnoredCheckPatterns` — both still have live consumers (`SafeBranch.js`, `AutoFixAllWaitCi.js`) and are out of scope for this issue.

## Files to Change

- `core/lib/utils/config/RepoConfig.js` — remove `getPlanIssuesRetryConfig`, `DEFAULT_MAX_RETRY_COUNT`, `DEFAULT_ERROR_SLEEP_TIME`, and `_numberOrDefault` (if confirmed unused by the remaining methods after this removal).
- `core/spec/lib/utils/config/RepoConfig_spec.js` — remove the now-dead `getPlanIssuesRetryConfig` test cases.

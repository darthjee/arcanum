## Description

Codacy's PMD tool flags 28 "Avoid Unnecessary Blocks" findings (17 files) under `core/lib/utils/` — ECMAScript blocks (`{ }`) that don't introduce a new scope and can mislead readers into thinking they do. Production source, not test code.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is one of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/bin`, `core/spec/support`, `core/spec/lib`, `core/lib/commands`, and the small remainder in `core/lib/services`+`core/lib/context`+`core/lib/core`.

## Affected files (count in parentheses)

`config/ConfigChain.js` (1), `config/RepoConfig.js` (1), `file/IssueFileLocator.js` (1), `file/IssueStatePaths.js` (1), `file/Lock.js` (1), `git/BranchCleanup.js` (2), `git/GitClient.js` (2), `git/Origin.js` (3), `github/GitHubClient.js` (3), `github/GithubToken.js` (1), `github/IssueClient.js` (1), `github/MergeBodyResolver.js` (3), `issue/IssueLinker.js` (1), `json/JsonParser.js` (3), `json/JsonReader.js` (2), `logging/InvocationLog.js` (1), `safe/SafeFetcher.js` (1).

(All paths relative to `core/lib/utils/`.)

## Expected Behavior

- Redundant `{ }` blocks in these 17 production files are removed with no behavior change (`yarn test` under `core/` still passes).
- Re-running PMD/Codacy across `core/lib/utils/` shows zero `UnnecessaryBlock` findings.

## Solution

Since this touches production source (not just specs), prefer a careful automated-fix + full test-suite run over hand-editing, particularly for `git/Lock.js` and `safe/SafeFetcher.js` given their names suggest safety-critical logic.


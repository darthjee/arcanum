## Description

Codacy's PMD tool flags the remaining 5 "Avoid Unnecessary Blocks" findings (4 files) scattered across `core/lib/services/`, `core/lib/context/`, and `core/lib/core/` — too small individually to warrant their own issues, bundled here.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is the last of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/bin`, `core/spec/support`, `core/spec/lib`, `core/lib/commands`, and `core/lib/utils`.

## Affected files (count in parentheses)

`core/lib/context/RepoContextFactory.js` (1), `core/lib/core/dispatcher.js` (1), `core/lib/services/IssueStateService.js` (2), `core/lib/services/PrMonitor.js` (1).

## Expected Behavior

- Redundant `{ }` blocks in these 4 production files are removed with no behavior change (`yarn test` under `core/` still passes).
- Re-running PMD/Codacy across these 3 directories shows zero `UnnecessaryBlock` findings.

## Solution

`core/lib/core/dispatcher.js` is the central command dispatcher — review its single finding carefully even though it's mechanical, since it's the most safety-sensitive file in this batch.


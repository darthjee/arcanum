# Issue: Codacy: PMD UnnecessaryBlock cluster — core/lib/commands (33 findings, 16 files)

## Description

Codacy's PMD tool flags 33 "Avoid Unnecessary Blocks" findings (16 files) under `core/lib/commands/` — ECMAScript blocks (`{ }`) that don't introduce a new scope and can mislead readers into thinking they do. Unlike the sibling `core/spec/*` clusters, these are in production source, not test code.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is one of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/bin`, `core/spec/support`, `core/spec/lib`, `core/lib/utils`, and the small remainder in `core/lib/services`+`core/lib/context`+`core/lib/core`.

**Affected files** (count in parentheses, all paths relative to `core/lib/commands/`):

`arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js` (1), `arcanum-update/ArcanumUpdateRunUpdate.js` (6), `auto-fix-all/AutoFixAllCheckoutFromMain.js` (1), `auto-fix-all/AutoFixAllConfig.js` (1), `auto-fix-all/AutoFixAllReplyComment.js` (2), `auto-fix-issue/AutoFixIssueCreateBranch.js` (1), `auto-fix-issue/AutoFixIssueGithub.js` (3), `auto-fix-issue/AutoFixIssueMergeMain.js` (2), `auto-monitor-pr/AutoMonitorPrMonitorPr.js` (3), `shared/GithubIssue.js` (1), `shared/IssueState.js` (2), `shared/ResolveAndFetch.js` (1), `shared/ResolveIdAndFile.js` (3), `shared/ResolvePlanPaths.js` (2), `shared/SafeBranch.js` (2), `shared/SpawnIssue.js` (2).

## Expected Behavior

- Redundant `{ }` blocks in these 16 production files are removed with no behavior change (`yarn test` under `core/` still passes).
- Re-running PMD/Codacy across `core/lib/commands/` shows zero `UnnecessaryBlock` findings.

## Solution

Since this touches production source (not just specs), prefer a careful automated-fix + full test-suite run over hand-editing, and review the diff before merging given it's `core/lib/commands/` (dispatch-critical code).

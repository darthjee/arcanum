# Issue: Codacy: PMD UnnecessaryBlock cluster — core/lib/commands (33 findings, 16 files)

## Description

Codacy's PMD tool (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`, category CodeStyle, severity Info) flagged 33 "Avoid Unnecessary Blocks" findings across 16 files under `core/lib/commands/`. Unlike the sibling `core/spec/*` clusters, these are production source, not test code.

This is one of 6 directory-scoped clusters for the same repo-wide pattern (#509 `core/spec/bin`, #510 `core/spec/support`, #511 `core/spec/lib`, #512 this one, #513 `core/lib/utils`, #514 `core/lib/services`+`core/lib/context`+`core/lib/core`).

**Affected files** (count in parentheses, relative to `core/lib/commands/`): `arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js` (1), `arcanum-update/ArcanumUpdateRunUpdate.js` (6), `auto-fix-all/AutoFixAllCheckoutFromMain.js` (1), `auto-fix-all/AutoFixAllConfig.js` (1), `auto-fix-all/AutoFixAllReplyComment.js` (2), `auto-fix-issue/AutoFixIssueCreateBranch.js` (1), `auto-fix-issue/AutoFixIssueGithub.js` (3), `auto-fix-issue/AutoFixIssueMergeMain.js` (2), `auto-monitor-pr/AutoMonitorPrMonitorPr.js` (3), `shared/GithubIssue.js` (1), `shared/IssueState.js` (2), `shared/ResolveAndFetch.js` (1), `shared/ResolveIdAndFile.js` (3), `shared/ResolvePlanPaths.js` (2), `shared/SafeBranch.js` (2), `shared/SpawnIssue.js` (2).

## Problem

The findings are false positives. PMD's ecmascript parser misidentifies required JS syntax as "unnecessary blocks": `try {` openers, arrow-function/Promise-executor bodies, and other constructs that cannot be removed without changing behavior. Verified on `origin/main`:

- `yarn eslint --rule '{"no-lone-blocks":"error"}'` across all 16 files reports zero lone-block violations (22 unrelated jsdoc warnings only, 0 errors).
- `core/eslint.config.mjs` has no `no-lone-blocks` rule configured at all — there is no lint gap being masked here.

The original plan of hand-editing or automated-fixing the blocks is therefore not applicable — there is nothing removable in these files.

## Expected Behavior

- The 16 files stay excluded from Codacy via `.codacy.yml` (already done — see Solution), and Codacy reports zero `UnnecessaryBlock` findings for them.
- No source or test changes; `yarn test` and `yarn lint` under `core/` are unaffected.

## Solution

Already implemented: commit `47f2422` (PR #529, "Fix #509") added the `# #512 — core/lib/commands (16 files)` block to `.codacy.yml` `exclude_paths`, listing all 16 files individually (not the whole directory, so other Codacy checks keep running on the remaining production files).

Verified: all 16 paths in `.codacy.yml` (lines 88-104) match the affected-files list above exactly.

Remaining work is closure only: confirm Codacy shows zero `UnnecessaryBlock` findings for these files, then close the issue. Same approach as #510 (PR #530) and #511 (PR #531).

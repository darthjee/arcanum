# Issue: Codacy: PMD UnnecessaryBlock cluster — core/spec/lib (51 findings, 17 files)

## Description

Codacy's PMD tool (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`, category CodeStyle, severity Info) flagged 51 "Avoid Unnecessary Blocks" findings across 17 files under `core/spec/lib/`.

This is one of 6 directory-scoped clusters for the same repo-wide pattern (#509 `core/spec/bin`, #510 `core/spec/support`, #511 this one, #512 `core/lib/commands`, #513 `core/lib/utils`, #514 `core/lib/services`+`core/lib/context`+`core/lib/core`).

Affected files (relative to `core/spec/lib/`): `commands/auto-fix-all/{AutoFixAllGithubWiring,AutoFixAllQueuePush,AutoFixAllQueueSave,AutoFixAllWaitCiTransientErrors}_spec.js`, `commands/auto-fix-issue/AutoFixIssueGithubPrCreate_spec.js`, `commands/auto-monitor-pr/AutoMonitorPrMonitorPr_spec.js`, `commands/discuss-issue/DiscussIssueConfirm_spec.js`, `context/RepoContextFactory_spec.js`, `core/dispatcherErrorHandling_spec.js`, `services/{PrChecker,PrMonitor,TagMutationService}_spec.js`, `utils/git/{GitBranch,Git}_spec.js`, `utils/github/{GitHubClient,PrOperationsPrNumber,PrOperationsQueries}_spec.js`.

## Problem

The findings are false positives. PMD's ecmascript parser misidentifies required JS syntax as "unnecessary blocks": `try {` openers, destructuring assignments, and returned object literals. Verification on `origin/main`:

- ESLint `no-lone-blocks` reports zero lone blocks anywhere in `core/spec/lib`.
- Every one of the 17 files contains at least one of the constructs above, none of which can be removed without changing behavior or breaking syntax.

The original plan of removing the blocks is therefore not applicable.

## Expected Behavior

- The 17 files stay excluded from Codacy via `.codacy.yml` (already done — see Solution), and Codacy reports zero `UnnecessaryBlock` findings for them.
- No source or test changes; `yarn test` and `yarn lint` under `core/` are unaffected.

## Solution

Already implemented: commit `47f2422` (PR #529, "Fix #509") added the `# #511 — core/spec/lib (17 files)` block to `.codacy.yml` `exclude_paths`, listing all 17 files individually (not the whole directory, so other Codacy checks keep running on the remaining spec files).

Verified: all 17 paths in `.codacy.yml` match the affected-files list above.

Remaining work is closure only: confirm Codacy shows zero `UnnecessaryBlock` findings for these files, then close the issue.

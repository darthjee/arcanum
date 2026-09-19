# Plan: Codacy: PMD UnnecessaryBlock cluster — core/spec/bin (94 findings, 33 files)

Issue: [509-codacy-pmd-unnecessaryblock-cluster-core-spec-bin-94-findings-33-files.md](../../issues/509-codacy-pmd-unnecessaryblock-cluster-core-spec-bin-94-findings-33-files.md)

## Overview

Investigation during discuss-issue pulled the live Codacy findings for pattern `PMD_category_ecmascript_codestyle_UnnecessaryBlock` directly from the API (not just the issue's summary) and covered every currently-open instance repo-wide: 211 findings across 87 files, spanning issues #509, #511, #512, #513, and #514 (#510's files are already excluded from Codacy for an unrelated reason — see below). All 211 fall into exactly four shapes: `try {` openers, destructuring assignments (`const { a, b } = ...`), returned object literals (`return { ... };`), and one switch-case block required by the already-enabled `no-case-declarations` ESLint rule. None are genuine redundant blocks — PMD's ecmascript parser is misidentifying required JS syntax, and none of them can be "fixed" in code without breaking the file or violating an existing lint rule.

The fix is a Codacy configuration change, not a code change: add the 87 affected files to `.codacy.yml`'s `exclude_paths`, scoped per-file rather than per-directory, since these directories also contain ~169 unrelated files whose other Codacy findings (security, error-prone, etc.) should keep being checked.

This single change resolves #509, #511, #512, #513, and #514 together — they share the same root cause and fix. #510 (`core/spec/support`) needs no action: its files are already covered by this file's pre-existing `core/spec/support/**` entry (added for an unrelated reason — issues #460/#496).

## Context

`.codacy.yml` already uses `exclude_paths` for exactly this kind of tool false positive (see its existing comments for issues #460, #496, #498, #500). The 87-file list below was captured directly from Codacy's `codacy_list_repository_issues` API filtered to this pattern ID, cross-checked against every affected issue's stated file/finding counts (#509: 33 files/94 findings, #511: 17/51, #512: 16/33, #513: 17/28, #514: 4/5 — all exact matches) — it is not re-derived from the issues' directory-summarized file listings, to guarantee no typos or omissions.

## Implementation Steps

### Step 1 — Add the 87 affected files to `.codacy.yml`'s `exclude_paths`

Add a new comment block above a new set of `exclude_paths` entries (matching the file's existing per-topic comment style) explaining the PMD ecmascript-parser false positive and citing issues #509, #510 (already covered), #511, #512, #513, #514. Then add exactly these 87 literal file paths (not directory globs) under `exclude_paths`, grouped by originating issue for traceability:

**#509 — `core/spec/bin` (33 files)**
- `core/spec/bin/arcanumSplitIssueFinishParity_spec.js`
- `core/spec/bin/arcanum_spec.js`
- `core/spec/bin/autoFixAllCheckoutFromMainParity/happy_path_spec.js`
- `core/spec/bin/autoFixAllCheckoutFromMainParity/merge_conflict_spec.js`
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js`
- `core/spec/bin/autoFixAllConfigParity/get_spec.js`
- `core/spec/bin/autoFixAllConfigParity/is_enabled_spec.js`
- `core/spec/bin/autoFixAllConfigParity/set_spec.js`
- `core/spec/bin/autoFixAllConfigParity/toggle_spec.js`
- `core/spec/bin/autoFixIssueCommitChangeParity_spec.js`
- `core/spec/bin/autoFixIssueCreateBranchParity_spec.js`
- `core/spec/bin/autoFixIssueListPlanAgentsParity_spec.js`
- `core/spec/bin/autoFixIssueListPlanStepsParity_spec.js`
- `core/spec/bin/autoFixIssueMergeMainParity_spec.js`
- `core/spec/bin/autoFixIssueRunChecksParity_spec.js`
- `core/spec/bin/autoNewIssueCommitIssueParity_spec.js`
- `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`
- `core/spec/bin/checkoutSafeBranchParity_spec.js`
- `core/spec/bin/discussIssueConfirmParity_spec.js`
- `core/spec/bin/discussIssueRenderIssueParity_spec.js`
- `core/spec/bin/githubIssueCreateParity_spec.js`
- `core/spec/bin/githubIssueInfoParity_spec.js`
- `core/spec/bin/issueStateParity/append_json_spec.js`
- `core/spec/bin/issueStateParity/argument_validation_spec.js`
- `core/spec/bin/issueStateParity/get_spec.js`
- `core/spec/bin/issueStateParity/set_json_spec.js`
- `core/spec/bin/issueStateParity/set_spec.js`
- `core/spec/bin/listAgentsParity_spec.js`
- `core/spec/bin/permissionGrantParity_spec.js`
- `core/spec/bin/resolveAndFetchParity_spec.js`
- `core/spec/bin/resolveIdAndFileParity_spec.js`
- `core/spec/bin/resolvePlanPathsParity_spec.js`
- `core/spec/bin/spawnIssueParity_spec.js`

**#511 — `core/spec/lib` (17 files)**
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubWiring_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueueSave_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiTransientErrors_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrCreate_spec.js`
- `core/spec/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr_spec.js`
- `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js`
- `core/spec/lib/context/RepoContextFactory_spec.js`
- `core/spec/lib/core/dispatcherErrorHandling_spec.js`
- `core/spec/lib/services/PrChecker_spec.js`
- `core/spec/lib/services/PrMonitor_spec.js`
- `core/spec/lib/services/TagMutationService_spec.js`
- `core/spec/lib/utils/git/GitBranch_spec.js`
- `core/spec/lib/utils/git/Git_spec.js`
- `core/spec/lib/utils/github/GitHubClient_spec.js`
- `core/spec/lib/utils/github/PrOperationsPrNumber_spec.js`
- `core/spec/lib/utils/github/PrOperationsQueries_spec.js`

**#512 — `core/lib/commands` (16 files)**
- `core/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js`
- `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`
- `core/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain.js`
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`
- `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js`
- `core/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch.js`
- `core/lib/commands/auto-fix-issue/AutoFixIssueGithub.js`
- `core/lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js`
- `core/lib/commands/auto-monitor-pr/AutoMonitorPrMonitorPr.js`
- `core/lib/commands/shared/GithubIssue.js`
- `core/lib/commands/shared/IssueState.js`
- `core/lib/commands/shared/ResolveAndFetch.js`
- `core/lib/commands/shared/ResolveIdAndFile.js`
- `core/lib/commands/shared/ResolvePlanPaths.js`
- `core/lib/commands/shared/SafeBranch.js`
- `core/lib/commands/shared/SpawnIssue.js`

**#513 — `core/lib/utils` (17 files)**
- `core/lib/utils/config/ConfigChain.js`
- `core/lib/utils/config/RepoConfig.js`
- `core/lib/utils/file/IssueFileLocator.js`
- `core/lib/utils/file/IssueStatePaths.js`
- `core/lib/utils/file/Lock.js`
- `core/lib/utils/git/BranchCleanup.js`
- `core/lib/utils/git/GitClient.js`
- `core/lib/utils/git/Origin.js`
- `core/lib/utils/github/GitHubClient.js`
- `core/lib/utils/github/GithubToken.js`
- `core/lib/utils/github/IssueClient.js`
- `core/lib/utils/github/MergeBodyResolver.js`
- `core/lib/utils/issue/IssueLinker.js`
- `core/lib/utils/json/JsonParser.js`
- `core/lib/utils/json/JsonReader.js`
- `core/lib/utils/logging/InvocationLog.js`
- `core/lib/utils/safe/SafeFetcher.js`

**#514 — `core/lib/services`, `core/lib/context`, `core/lib/core` (4 files)**
- `core/lib/context/RepoContextFactory.js`
- `core/lib/core/dispatcher.js`
- `core/lib/services/IssueStateService.js`
- `core/lib/services/PrMonitor.js`

## Files to Change

- `.codacy.yml` — add the 87 file paths above to `exclude_paths`, with an explanatory comment block citing issues #509, #510, #511, #512, #513, #514.

## CI Checks

N/A — this is a Codacy analysis-configuration change with no effect on `core/`'s own `yarn test`/`yarn lint`; verified instead by re-running Codacy analysis after merge and confirming zero `PMD_category_ecmascript_codestyle_UnnecessaryBlock` findings remain for these files.

## Notes

- This plan intentionally does not touch any of the 87 files' actual source — the finding is a tool false positive, and every candidate "fix" (removing a `try` block, a destructuring assignment, or a returned object literal's braces) would either break the code or violate the existing `no-case-declarations` ESLint rule.
- No specialist agent owns this change: `.codacy.yml` is a root-level file (architect's scope per `AGENTS.md`), and none of `node`/`infra`/`scripter`/`skill-writer`/`skill-reviewer` have work here.
- Once merged, close #510 (already resolved) and #511–#514 as duplicates/resolved-by-this-change, referencing this PR.

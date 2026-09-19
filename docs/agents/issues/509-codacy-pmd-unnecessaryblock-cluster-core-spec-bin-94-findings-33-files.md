# Issue: Codacy: PMD UnnecessaryBlock cluster — core/spec/bin (94 findings, 33 files)

## Description

Codacy's PMD tool flags 94 "Avoid Unnecessary Blocks" findings (33 files) under `core/spec/bin/` — pattern `PMD_category_ecmascript_codestyle_UnnecessaryBlock` (CodeStyle, Info).

**Investigation finding (supersedes the original framing):** pulling the live findings directly from Codacy's API (not just the issue summary) shows every one of the 211 currently-open findings for this pattern repo-wide — 94 here plus the 5 companion directory-scoped clusters (#510–#514, 282 findings/115 files as originally filed) — is a **false positive**. PMD's ecmascript parser is misidentifying required JS syntax as "unnecessary blocks": `try {` openers, destructuring assignments (`const { a, b } = ...`), returned object literals (`return { ... };`), and one switch-case block required by the already-enabled `no-case-declarations` ESLint rule. None of these can be removed without breaking the code or violating an existing lint rule — this is not a real code-style problem.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is the largest of 6 directory-scoped clusters for this same repo-wide pattern; see companion issues #510 (`core/spec/support`, already resolved — see below), #511 (`core/spec/lib`), #512 (`core/lib/commands`), #513 (`core/lib/utils`), and #514 (`core/lib/services`+`core/lib/context`+`core/lib/core`). The fix for all of them is a single shared `.codacy.yml` change — see the plan for the exact file list and grouping.

## Affected files (count in parentheses)

`arcanumSplitIssueFinishParity_spec.js` (4), `arcanum_spec.js` (5), `autoFixAllCheckoutFromMainParity/happy_path_spec.js` (3), `autoFixAllCheckoutFromMainParity/merge_conflict_spec.js` (1), `autoFixAllCleanupArtifactsParity_spec.js` (3), `autoFixAllConfigParity/get_spec.js` (1), `autoFixAllConfigParity/is_enabled_spec.js` (1), `autoFixAllConfigParity/set_spec.js` (3), `autoFixAllConfigParity/toggle_spec.js` (1), `autoFixIssueCommitChangeParity_spec.js` (3), `autoFixIssueCreateBranchParity_spec.js` (3), `autoFixIssueListPlanAgentsParity_spec.js` (3), `autoFixIssueListPlanStepsParity_spec.js` (3), `autoFixIssueMergeMainParity_spec.js` (5), `autoFixIssueRunChecksParity_spec.js` (3), `autoNewIssueCommitIssueParity_spec.js` (3), `autoPlanIssueCommitPlanParity_spec.js` (3), `checkoutSafeBranchParity_spec.js` (4), `discussIssueConfirmParity_spec.js` (3), `discussIssueRenderIssueParity_spec.js` (3), `githubIssueCreateParity_spec.js` (4), `githubIssueInfoParity_spec.js` (4), `issueStateParity/append_json_spec.js` (1), `issueStateParity/argument_validation_spec.js` (1), `issueStateParity/get_spec.js` (1), `issueStateParity/set_json_spec.js` (2), `issueStateParity/set_spec.js` (1), `listAgentsParity_spec.js` (4), `permissionGrantParity_spec.js` (5), `resolveAndFetchParity_spec.js` (3), `resolveIdAndFileParity_spec.js` (3), `resolvePlanPathsParity_spec.js` (3), `spawnIssueParity_spec.js` (4).

(All paths relative to `core/spec/bin/`.)

## Expected Behavior

- `.codacy.yml` lists these 33 files (plus the other 54 affected across #511–#514) under `exclude_paths`, so Codacy stops reporting `PMD_category_ecmascript_codestyle_UnnecessaryBlock` for them.
- No source code in `core/spec/bin/` (or the companion clusters) is modified — there is nothing to safely remove.
- `yarn test`/`yarn lint` under `core/` are unaffected (no source change).
- Re-running Codacy shows zero `UnnecessaryBlock` findings for these files, and other Codacy checks on these files continue to run as before (only this one pattern is suppressed, and only for these exact files).

## Solution

Not a code fix — a Codacy configuration change. See [the implementation plan](../plans/509-codacy-pmd-unnecessaryblock-cluster-core-spec-bin-94-findings-33-files/plan.md) for the exact 87-file list (grouped by originating issue #509/#511/#512/#513/#514) to add to `.codacy.yml`'s `exclude_paths`, scoped per-file (not per-directory) to avoid silencing unrelated Codacy checks on the ~169 other files in these same directories.

This single change resolves #509, #511, #512, #513, and #514 together. #510 (`core/spec/support`) needs no action — already covered by `.codacy.yml`'s pre-existing `core/spec/support/**` exclusion (added for an unrelated reason — issues #460/#496).

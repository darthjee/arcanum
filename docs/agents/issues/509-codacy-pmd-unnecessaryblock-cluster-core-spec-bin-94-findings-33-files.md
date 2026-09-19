# Issue: Codacy: PMD UnnecessaryBlock cluster — core/spec/bin (94 findings, 33 files)

## Description

Codacy's PMD tool flags 94 "Avoid Unnecessary Blocks" findings (33 files) under `core/spec/bin/` — ECMAScript blocks (`{ }`) that don't introduce a new scope and can mislead readers into thinking they do.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is the largest of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/support`, `core/spec/lib`, `core/lib/commands`, `core/lib/utils`, and the small remainder in `core/lib/services`+`core/lib/context`+`core/lib/core`.

## Affected files (count in parentheses)

`arcanumSplitIssueFinishParity_spec.js` (4), `arcanum_spec.js` (5), `autoFixAllCheckoutFromMainParity/happy_path_spec.js` (3), `autoFixAllCheckoutFromMainParity/merge_conflict_spec.js` (1), `autoFixAllCleanupArtifactsParity_spec.js` (3), `autoFixAllConfigParity/get_spec.js` (1), `autoFixAllConfigParity/is_enabled_spec.js` (1), `autoFixAllConfigParity/set_spec.js` (3), `autoFixAllConfigParity/toggle_spec.js` (1), `autoFixIssueCommitChangeParity_spec.js` (3), `autoFixIssueCreateBranchParity_spec.js` (3), `autoFixIssueListPlanAgentsParity_spec.js` (3), `autoFixIssueListPlanStepsParity_spec.js` (3), `autoFixIssueMergeMainParity_spec.js` (5), `autoFixIssueRunChecksParity_spec.js` (3), `autoNewIssueCommitIssueParity_spec.js` (3), `autoPlanIssueCommitPlanParity_spec.js` (3), `checkoutSafeBranchParity_spec.js` (4), `discussIssueConfirmParity_spec.js` (3), `discussIssueRenderIssueParity_spec.js` (3), `githubIssueCreateParity_spec.js` (4), `githubIssueInfoParity_spec.js` (4), `issueStateParity/append_json_spec.js` (1), `issueStateParity/argument_validation_spec.js` (1), `issueStateParity/get_spec.js` (1), `issueStateParity/set_json_spec.js` (2), `issueStateParity/set_spec.js` (1), `listAgentsParity_spec.js` (4), `permissionGrantParity_spec.js` (5), `resolveAndFetchParity_spec.js` (3), `resolveIdAndFileParity_spec.js` (3), `resolvePlanPathsParity_spec.js` (3), `spawnIssueParity_spec.js` (4).

(All paths relative to `core/spec/bin/`.)

## Expected Behavior

- Redundant `{ }` blocks in these 33 files are removed without changing test behavior (`yarn test` under `core/` still passes).
- Re-running PMD/Codacy across `core/spec/bin/` shows zero `UnnecessaryBlock` findings.
- `core/eslint.config.mjs` permanently enables an equivalent rule (e.g. `no-lone-blocks`) so unnecessary blocks in these files are caught going forward, not just cleaned up once.

## Solution

`core/eslint.config.mjs` does not currently have `no-lone-blocks` (or any equivalent) configured, so this is not yet a pure autofix pass. As decided during refinement:

1. Add `no-lone-blocks: 'error'` (or the closest available equivalent) to `core/eslint.config.mjs`, scoped at least to `spec/**/*.js` (or repo-wide, whichever fits the existing config structure best).
2. Run `eslint --fix` under `core/` to remove the redundant blocks in `core/spec/bin/` automatically where possible.
3. Hand-fix any remaining findings ESLint's autofix doesn't cover, then run `yarn test` under `core/` to confirm no behavior change.
4. Re-run Codacy/PMD analysis on `core/spec/bin/` to confirm zero `UnnecessaryBlock` findings remain.

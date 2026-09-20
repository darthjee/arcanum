# Plan: Codacy: PMD UnnecessaryBlock cluster — core/spec/lib (51 findings, 17 files)

Issue: [511-codacy-pmd-unnecessaryblock-cluster-core-spec-lib-51-findings-17-files.md](../../issues/511-codacy-pmd-unnecessaryblock-cluster-core-spec-lib-51-findings-17-files.md)

## Overview
The 51 PMD `UnnecessaryBlock` findings in `core/spec/lib/` are false positives (PMD's ecmascript parser misreads `try {` openers, destructuring assignments and returned object literals). The fix — excluding the 17 files in `.codacy.yml` — already shipped in commit `47f2422` (PR #529, "Fix #509"). No source, test or config change is needed; this plan only verifies that exclusion and closes the issue.

## Context
- `.codacy.yml` `exclude_paths` already contains the `# #511 — core/spec/lib (17 files)` block, one entry per affected file (not the whole directory, so other Codacy checks keep running on the remaining spec files).
- Verified on `origin/main` while refining: all 17 paths match the issue's affected-files list; ESLint `no-lone-blocks` reports zero lone blocks in `core/spec/lib`; every one of the 17 files contains at least one of the constructs PMD misreads, so removing "redundant blocks" is not possible.
- Codacy's API returns zero `UnnecessaryBlock` findings for the repo.

## Implementation Steps

### Step 1 — Re-verify the exclusion is in place
Confirm `.codacy.yml` on the branch still lists all 17 `core/spec/lib/...` files under the `# #511` comment block, and that the paths match the issue's affected-files list (re-check only if `.codacy.yml` changed since `47f2422`). No file edits expected.

### Step 2 — Confirm Codacy state and close
Confirm Codacy reports zero `PMD_category_ecmascript_codestyle_UnnecessaryBlock` findings for the 17 files (Codacy UI, or `codacy_list_repository_issues` filtered by that pattern). If so, close the issue as already resolved by #529 with a comment linking the commit. If findings still appear, the exclusion is not taking effect — investigate the `.codacy.yml` path syntax instead of removing blocks.

## Files to Change
- None expected. (`.codacy.yml` only if Step 2 finds the exclusion is not taking effect.)

## Notes
- Do not remove blocks from the spec files: `try {`, destructuring and `return { … }` are required syntax, and the already-enabled `no-case-declarations` ESLint rule constrains the remaining switch-case block elsewhere in the cluster set.
- Sibling clusters #509, #510, #512, #513 and #514 were covered by the same commit and can be closed the same way.
- No CI job applies: there are no code changes. Local sanity checks if any file is touched: `yarn test` and `yarn lint` under `core/`.

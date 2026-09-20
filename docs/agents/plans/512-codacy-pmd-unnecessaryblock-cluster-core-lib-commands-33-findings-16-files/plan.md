# Plan: Codacy: PMD UnnecessaryBlock cluster — core/lib/commands (33 findings, 16 files)

Issue: [512-codacy-pmd-unnecessaryblock-cluster-core-lib-commands-33-findings-16-files.md](../issues/512-codacy-pmd-unnecessaryblock-cluster-core-lib-commands-33-findings-16-files.md)

## Overview

The 33 PMD `UnnecessaryBlock` findings across the 16 listed files are false
positives (PMD's ecmascript parser misreading `try {` openers,
arrow-function/Promise-executor bodies, and other required syntax as
removable blocks). Commit `47f2422` (PR #529, "Fix #509") already added a
`# #512 — core/lib/commands (16 files)` block to `.codacy.yml`
`exclude_paths` listing all 16 files, so Codacy is already suppressing this
finding for them. No source change is needed or possible — there is nothing
to remove. This plan is verification-only, matching the resolution already
used for #510 (PR #530) and #511 (PR #531).

## Context

- ESLint has no `no-lone-blocks` rule configured in `core/eslint.config.mjs`.
- Running `yarn eslint --rule '{"no-lone-blocks":"error"}'` against all 16
  files from `core/` reports 0 errors (only 22 unrelated pre-existing
  `jsdoc` warnings), confirming none of the files contain an actual
  removable lone block.
- `.codacy.yml` lines 88-104 already list all 16 affected paths verbatim
  under the `# #512 — core/lib/commands (16 files)` exclusion block.

## Implementation Steps

### Step 1 — Re-verify the `.codacy.yml` exclusion is intact and complete

Confirm, on the PR branch, that `.codacy.yml`'s `# #512 — core/lib/commands
(16 files)` block still lists exactly the 16 affected paths from the issue,
and that no other change to `.codacy.yml` has altered or removed it since
commit `47f2422`. No edit expected — this step only asserts the file is
already correct.

### Step 2 — Re-run the no-lone-blocks check and record the result

Re-run `yarn eslint --rule '{"no-lone-blocks":"error"}'` (from `core/`)
against the 16 affected files and confirm 0 errors, to reconfirm there is
nothing left to fix before closing the issue. Note the result in the PR
description (no committed artifact needed — this is a closure check, not a
new test).

## Files to Change

None. `.codacy.yml` already contains the correct exclusion; no production
source, test, or config file needs editing.

## Notes

- This issue nets zero file changes to `core/`, same as #510/#511. The PR
  should say so explicitly in its description so reviewers aren't surprised
  by an empty diff (beyond the issue-doc/plan-doc housekeeping commits).
- Planning artifacts under this `PLAN_DIR` are expected to be removed
  before merge, per this repo's convention for closed-as-verified issues in
  this cluster (see #511/PR #531).

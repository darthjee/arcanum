# Node Plan: Codacy: PMD UnnecessaryBlock cluster — core/lib/utils (28 findings, 17 files)

## Overview

Investigation during planning found this cluster is **already resolved**: all 17 `core/lib/utils/` files listed in the issue are already present in `.codacy.yml`'s `exclude_paths`, under the `# #513 — core/lib/utils (17 files)` comment block. That exclusion was added in bulk (commit `47f2422`, PR #529, "Fix #509") alongside the exclusions for #509–#512 and #514, and the header comment documents why: PMD's ecmascript parser misreads required JS syntax (`try {` openers, destructuring assignments, returned object literals, a `no-case-declarations`-mandated switch-case block, etc.) as removable "unnecessary blocks" — these are false positives that cannot be fixed by removing code without breaking it or violating an existing lint rule. This is the exact same resolution pattern already used to close #512 (PR #532): a verification-only PR, no source changes.

## Implementation Steps

### Step 1 — Verify the exclusion list is complete and accurate

Confirm the `# #513 — core/lib/utils (17 files)` block in `.codacy.yml` lists exactly the 17 files named in the issue's "Affected files" section, with matching paths and no omissions/extras. Cross-check counts too (issue says 28 findings across 17 files — the exclusion is file-scoped, not finding-scoped, so file count is what matters).

### Step 2 — Re-confirm none of the 17 files contain an actual removable lone block

Run `yarn eslint --rule '{"no-lone-blocks":"error"}'` (from `core/`) against the 17 files to double check none of them have a genuinely removable block that should be fixed instead of excluded. Expect 0 errors related to `no-lone-blocks` (pre-existing unrelated warnings, e.g. `jsdoc`, are fine and out of scope).

## Files to Change

None expected. `.codacy.yml` already contains the correct exclusion for all 17 files; this plan is a verification pass, matching #512's precedent (PR #532) of a zero-diff closure. If Step 1 or Step 2 surfaces a real discrepancy (a missing/extra path, or an actual removable block), fix `.codacy.yml` and/or the specific file — but no such change is expected going in.

## CI Checks

- `core`: `yarn eslint --rule '{"no-lone-blocks":"error"}' <files>` — ad hoc verification command, not a standing CI job; the standing `core` lint job is `yarn lint` (`eslint .`), which already passes since `.codacy.yml` exclusions are consumed by Codacy directly, not by local eslint.

## Notes

- No behavior change and no `yarn test` risk since no source file is expected to change — unlike a from-scratch fix, this is a documentation/verification closure.
- If the PR body follows the #512 precedent, it should explain this is a verification-only closure referencing the commit/PR that already added the exclusion, and note that planning artifacts under this issue's plan folder will be removed before merge per repo convention.

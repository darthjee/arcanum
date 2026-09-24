# Issue: Codacy: PMD UnnecessaryBlock false positives — core/ (96 findings, 47 files)

## Description

PMD's ecmascript parser flags `Unnecessary block.` (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`, category CodeStyle, severity **Info**) on required JS syntax: `try {` openers, destructuring assignments, returned object literals and `switch` case blocks. #509–#514 already established that **every** finding of this pattern is a false positive.

Codacy currently reports 96 new findings across 47 `core/` files (new and migrated files not covered by the earlier fixes). The full list is in the Codacy API snapshot from 2026-09-24 (commit `a95732d`).

## Problem

- #509–#514 fixed this by listing 87 files, one by one, under the **global** `exclude_paths` in `.codacy.yml`. The global list turns off **every** Codacy tool on those files (ESLint, Lizard, Opengrep, …), not just PMD. This contradicts the stated goal of "keeping other Codacy checks running".
- The per-file list has to grow every time a new `core/` JS file is added or migrated, so the same kind of issue keeps coming back (this is the second round).
- `.codacy.yml` already has a narrower way to do this: `engines.<tool>.exclude_paths` (used for `opengrep` in #604) scopes an exclusion to a single tool.

## Expected Behavior

- Codacy reports zero `PMD_category_ecmascript_codestyle_UnnecessaryBlock` findings on `core/`, now and for future `core/` JS files, with no per-file maintenance.
- Every other Codacy tool analyses **all** `core/` JS files again, including the 87 files that the #509–#514 entries had fully excluded.
- No JS source changes: `yarn test` and `yarn lint` are unaffected.

## Solution

All changes are in `.codacy.yml` (infra / architect scope, no code changes).

1. **Find the PMD engine key.** Look up the PMD tool's `shortName` in Codacy's API (`api/v3/tools`) or its configuration-file docs, the same way #604 found `opengrep`. Codacy may list more than one PMD tool (e.g. legacy PMD and PMD 7). Use the one that emits `PMD_category_ecmascript_*` patterns. If both apply, add both.
2. **Add a PMD-scoped glob exclusion:**
   ```yaml
   engines:
     opengrep:
       exclude_paths:
         - "core/Dockerfile"
     <pmd-key>:
       exclude_paths:
         - "core/**/*.js"
   ```
3. **Remove the 87 per-file entries** under the `# #509`, `# #511`, `# #512`, `# #513` and `# #514` groups from the global `exclude_paths`. Keep `core/spec/support/**`, `CLAUDE.md`, `.github/copilot-instructions.md` and `core/yarn.lock`.
4. **Rewrite the header comment** that covers the 87-file exclusion. Explain that PMD is excluded from `core/**/*.js` because every `UnnecessaryBlock` finding there is a false positive on required syntax. Explain that it is scoped to PMD so the other tools keep running. Reference #509–#514 and #609.

**Side effect to expect:** the 87 files re-enter analysis for the other tools. New non-PMD findings on them are real results the global exclusion was hiding. Track them as separate follow-up issues rather than fixing them here.

## Benefits

- One glob replaces a per-file list that kept growing, so there are no more repeat "UnnecessaryBlock on new files" issues.
- Restores ESLint/Lizard/Opengrep coverage on 87 files that were being silently skipped.
- Consistent with the engine-scoped exclusion pattern `.codacy.yml` already uses for `opengrep`.

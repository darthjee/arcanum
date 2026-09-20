# Issue: Codacy: PMD UnnecessaryBlock cluster — core/lib/services, context, core (5 findings, 4 files)

## Description

Codacy's PMD tool originally flagged 5 "Avoid Unnecessary Blocks" findings (4 files) scattered across `core/lib/services/`, `core/lib/context/`, and `core/lib/core/` — too small individually to warrant their own issues, bundled here.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool PMD (`PMD_category_ecmascript_codestyle_UnnecessaryBlock`).

This is the last of 6 directory-scoped clusters for this same repo-wide pattern (282 findings / 115 files total); see companion issues for `core/spec/bin` (#509), `core/spec/support` (#510), `core/spec/lib` (#511), `core/lib/commands` (#512), and `core/lib/utils` (#513).

**Update:** investigation found the 4 affected files are already excluded from the `UnnecessaryBlock` check by commit `47f2422` (PR #529, fixing #509), which added a consolidated `.codacy.yml` exclusion list covering all 6 clusters — including this one, explicitly noting it "Resolves #509, #511, #512, #513, #514." Independently confirmed zero ESLint `no-lone-blocks` violations across all 4 files (`npx eslint --rule '{"no-lone-blocks":"error"}' <files>` under `core/`). This rewrites the issue to match the verification-only resolution already used for #510/#511/#512.

## Affected files (already excluded in `.codacy.yml`)

`core/lib/context/RepoContextFactory.js` (1), `core/lib/core/dispatcher.js` (1), `core/lib/services/IssueStateService.js` (2), `core/lib/services/PrMonitor.js` (1).

## Expected Behavior

- No source changes needed — the 4 files are already excluded from PMD's `UnnecessaryBlock` check in `.codacy.yml`.
- Re-running PMD/Codacy across these 3 directories shows zero `UnnecessaryBlock` findings (already true via the exclusion).
- `npx eslint --rule '{"no-lone-blocks":"error"}'` confirms zero real lone-block violations across the 4 files, independently verifying nothing was masked by the exclusion.

## Solution

Verification-only: confirm the existing `.codacy.yml` exclusion (added by commit `47f2422`) already covers all 4 files, and confirm zero ESLint `no-lone-blocks` violations across them. No code changes to `core/lib/core/dispatcher.js` or the other 3 files are required.

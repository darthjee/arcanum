# Issue: Investigate Codacy suppression for XSS false positive in fakeGithubApiFetchPreload.js

## Description

`core/spec/support/utils/fakeGithubApiFetchPreload.js` builds fake GitHub REST API JSON responses for specs, assigning plain strings built from env-var-driven test fixtures (e.g. `FAKE_FETCH_PR_URL`) to `html_url` properties — mirroring GitHub's own REST API field naming. These values are JSON-serialized mock response bodies; they are never rendered as markup or assigned to the DOM.

Querying Codacy's API directly for this repository confirms two currently open findings against this file, both titled "Unencoded input 'prUrl' used in HTML context" (security category XSS, priority High, status OnTrack, opened 2026-08-23, due 2026-10-22). This is a Security/Risk-Management (SRM) dashboard finding, not a `core/eslint.config.mjs`-configured ESLint rule: `eslint-plugin-xss` is not a dependency of this repo and is not referenced anywhere in `core/eslint.config.mjs`, so the finding is produced entirely by Codacy's own hosted analysis, independent of the repo's own local ESLint run. (Note: this differs from the original assumption that the finding comes from `eslint-plugin-xss`'s `no-mixed-html` ESLint rule — the actual Codacy tooling/rule name behind this SRM item isn't exposed by the API used here; only its title, category, and priority are.)

Exact line numbers for the two open findings aren't exposed by the Codacy API calls available here, only each finding's dashboard URL (resultDataId 131530704297 and 131530705345, under `https://app.codacy.com/p/883699/issues/index`). By inspection, the file has four `html_url: <non-literal-expression>` assignments matching this shape: line ~112 (`wait-ci` mode, `html_url: prUrl`), line ~171 (`github` mode, `html_url: prUrl`), line ~240 (`auto-fix-issue-github` mode, `html_url: prCreateUrl`), and line ~249 (`auto-fix-issue-github` mode, `html_url: prUrl`) — plus one string-literal occurrence (line ~22, `success` mode) that isn't a candidate. Only two findings are currently open, both naming `prUrl` specifically (not `prCreateUrl`), so they most likely correspond to lines ~112 and ~171 — this should be confirmed against the two dashboard links above before making any change.

## Problem

These two open, High-priority Codacy SRM findings are noise: `prUrl` here is always a test-fixture string derived from an env var read by a spec preload module, never rendered as HTML or assigned to the DOM, so there is no real XSS risk. Left open, they inflate the repo's security-issue count and due-date tracking on Codacy's SRM dashboard without indicating anything actionable.

## Solution

Scope is limited to the two currently-open findings only (not the two other look-alike, currently-unflagged `html_url: <non-literal>` sites at lines ~240 and ~249 — those are left untouched unless Codacy flags them in the future).

- Open the two dashboard links above to confirm the exact flagged lines/snippets before making any change.
- Suppress both findings via a two-part fix (not code-comment-only, since it's unconfirmed whether a source comment alone silences an SRM dashboard finding as opposed to a "quality issue" in Codacy's ordinary issues list, which #460 — the precedent this otherwise follows — was):
  1. Mark both SRM findings "Ignored"/false-positive via Codacy's own dashboard or API (SRM items carry a dedicated ignore/dismiss status for exactly this).
  2. Add a plain in-code explanatory comment above each of the two flagged assignments, referencing this issue, so future contributors understand why the suppression exists and don't remove it without checking — mirroring the comment style used for issue #460's `engineDispatchFixtures.js`/`gitFixtureRepo.js`/`autoFixAllCheckoutFromMainParitySetup.js` fix.
- Document the reasoning in the comment: a JSON field name coincidentally containing `html`, not actual markup.
- Confirm the two Codacy findings no longer appear as open (or are properly marked ignored/false positive) on the next analysis.

## Benefits

Removes two open, High-priority false-positive findings from Codacy's SRM dashboard, keeps the signal-to-noise ratio high for genuine XSS risks, and leaves a documented trail (referencing this issue) explaining the exception for future contributors.

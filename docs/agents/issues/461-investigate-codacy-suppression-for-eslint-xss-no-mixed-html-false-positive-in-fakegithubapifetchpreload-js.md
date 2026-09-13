# Investigate Codacy suppression for ESLint xss/no-mixed-html false positive in fakeGithubApiFetchPreload.js

## Context

`core/spec/support/utils/fakeGithubApiFetchPreload.js` builds fake GitHub REST API JSON responses for specs by constructing objects with properties such as `html_url` (e.g. `html_url: prUrl`, `html_url: prCreateUrl`), where the value is a plain string built from env-var-driven test fixtures rather than any untrusted or user-controlled input, and is never rendered as markup or assigned to the DOM. Codacy's ESLint analysis (via `eslint-plugin-xss`'s `no-mixed-html` rule) appears to flag these assignments because the property name contains `html` and its value is not a string literal, even though the rule cannot see that this is a JSON-serialized mock response body (mirroring GitHub's own `html_url` field naming) and not HTML markup subject to injection. This is a known class of false positive for the rule when a property merely happens to be named with an `html` substring, and it is currently producing noise in Codacy's findings without indicating a real risk.

## What needs to be done

- Confirm the exact Codacy finding (rule id, file, line numbers) currently reported against `fakeGithubApiFetchPreload.js` for `xss/no-mixed-html`, including every `html_url: <expr>` occurrence it flags (e.g. in the `wait-ci-and-merge`, `github`, and `auto-fix-issue-github` fake-fetch modes).
- Investigate the available suppression mechanisms and pick the most appropriate one, weighing tradeoffs:
  - Inline suppression scoped to the specific `html_url` assignments (e.g. an ESLint disable comment with a justification, if Codacy honors inline ESLint suppressions), local to `core/spec/support/utils/fakeGithubApiFetchPreload.js`.
  - Codacy-level suppression (ignoring the specific finding via the Codacy UI/API, or a repository-level Codacy configuration file) if inline suppression is not honored or not desired.
- Document the chosen approach and the reasoning (why it's a false positive here — a JSON field name coincidentally containing `html`, not actual markup) so future contributors understand why the suppression exists and don't remove it without checking.
- Apply the suppression and confirm the Codacy finding no longer appears (or is properly marked as ignored/false positive) on subsequent analysis.

## Acceptance criteria

- [ ] TODO

# Investigate Codacy suppression for ESLint detect-non-literal-fs-filename false positive in engineDispatchFixtures.js

## Context

`core/spec/support/fixtures/engineDispatchFixtures.js` builds throwaway shell fixtures for the `engine_dispatch` spec suite by calling `writeFile` with paths assembled via `path.join(dir, ...)`, where `dir` is a caller-supplied temporary test directory rather than any untrusted or user-controlled input. Codacy's ESLint analysis (via `eslint-plugin-security`'s `detect-non-literal-fs-filename` rule) flags these `writeFile` calls because the filename argument is not a string literal, even though the rule cannot see that `dir` only ever originates from trusted test setup (e.g. a Jasmine/Node `mkdtemp`-style helper). This is a known class of false positive for the rule in test fixture code, and it is currently producing noise in Codacy's findings without indicating a real risk.

## What needs to be done

- Confirm the exact Codacy finding (rule id, file, line numbers) currently reported against `engineDispatchFixtures.js` for `detect-non-literal-fs-filename`.
- Investigate the available suppression mechanisms and pick the most appropriate one, weighing tradeoffs:
  - Inline suppression scoped to the specific `writeFile` calls (e.g. an ESLint disable comment with a justification, if Codacy honors inline ESLint suppressions), local to `core/spec/support/fixtures/engineDispatchFixtures.js`.
  - Codacy-level suppression (ignoring the specific finding via the Codacy UI/API, or a repository-level Codacy configuration file) if inline suppression is not honored or not desired.
- Document the chosen approach and the reasoning (why it's a false positive here) so future contributors understand why the suppression exists and don't remove it without checking.
- Apply the suppression and confirm the Codacy finding no longer appears (or is properly marked as ignored/false positive) on subsequent analysis.

## Acceptance criteria

- [ ] TODO

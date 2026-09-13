# Issue: Investigate Codacy suppression for ESLint detect-non-literal-fs-filename false positives across core/spec test fixtures

## Description
`core/spec/support/fixtures/engineDispatchFixtures.js` builds throwaway shell fixtures for the `engine_dispatch` spec suite. Its `buildDispatchFixtures(dir)` helper calls `writeFile` twice, with paths built via `path.join(dir, ...)`, where `dir` is a caller-supplied temporary test directory rather than any untrusted or user-controlled input (confirmed by reading the file: `dir` only ever flows in from trusted test setup, e.g. a Jasmine/Node `mkdtemp`-style helper, never from user input).

Codacy's `detect-non-literal-fs-filename` finding fires on these `writeFile` calls because the filename argument is not a string literal — the rule cannot see that `dir` is always trusted. This is a known false-positive class for the rule in test-fixture code, and it is **not unique to this file**: a repo-wide search turns up dozens of the same `writeFile(path.join(dir, ...), ...)` / `path.join(repoPath, ...)` pattern across `core/spec/support/fixtures/`, `core/spec/support/factories/`, `core/spec/support/utils/`, and individual `*_spec.js` files (e.g. `autoFixIssueListPlanAgentsParity_spec.js`, `resolveAndFetchParity_spec.js`, `gitFixtureRepo.js`). In every case the directory component comes from trusted test setup (a temp dir, a fixture repo path), never from external/user input.

Notably, `eslint-plugin-security` (the plugin that defines `detect-non-literal-fs-filename`) is not a dependency of `core/package.json` and is not wired into `core/eslint.config.mjs` — the repo's local ESLint run never executes this rule at all. That means any such finding comes entirely from Codacy's own bundled analysis, independent of the repo's local lint config, so a plain `// eslint-disable-next-line` comment in fixture code would have no effect on Codacy's own scan.

## Problem
This is pure noise, and it doesn't stop at one file: the same false-positive shape (a non-literal `fs` path built from a trusted, test-controlled directory) recurs throughout `core/spec/`'s fixtures, factories, and test files. Suppressing only `engineDispatchFixtures.js` would leave the rest still cluttering Codacy's results, making it harder to notice genuine security findings.

## Expected Behavior
Codacy's `detect-non-literal-fs-filename` finding is durably suppressed for this whole class of test-fixture code (starting from `engineDispatchFixtures.js`, but covering the equivalent pattern elsewhere under `core/spec/`), through a mechanism Codacy actually honors — with the reasoning documented so a future contributor doesn't remove the suppression, or reintroduce the same flagged pattern, without understanding why it's safe here.

## Solution
- Confirm the exact Codacy finding(s) (rule/pattern id, files, line numbers) currently reported for `detect-non-literal-fs-filename`, via the Codacy dashboard/API — starting with `engineDispatchFixtures.js`, then checking whether the same pattern is already flagged elsewhere under `core/spec/`.
- Because `eslint-plugin-security` isn't installed or configured locally, treat Codacy-level suppression as the primary mechanism, rather than relying on an inline ESLint disable comment that Codacy's own scan won't see. Given how widespread the pattern is, prefer a **scoped ignore rule** (e.g. ignoring the `detect-non-literal-fs-filename` pattern for the `core/spec/**` path glob in Codacy's pattern settings, or an equivalent repository-level Codacy ignore configuration) over ignoring each individual finding one by one.
- Optionally, still add local code comments near representative `writeFile`/`writeFileSync` calls explaining why the directory is trusted — useful documentation for human readers even though it doesn't affect Codacy's scan.
- Document the chosen suppression and its reasoning (why this is a false positive for test-fixture code specifically) so future contributors understand why it exists and don't remove it without checking.
- Confirm, on a subsequent Codacy analysis, that the finding no longer appears under `core/spec/` (or is shown as properly ignored/false positive).

## Benefits
- Removes false-positive noise from Codacy across the whole test-fixture pattern, not just one file, without weakening the rule's ability to catch genuinely risky non-literal filesystem writes in production code.
- Keeps Codacy's security-category signal trustworthy for future findings.
- Documents the reasoning so the suppression survives future refactors and new fixtures written the same way, instead of being silently removed or needing to be reapplied file-by-file.

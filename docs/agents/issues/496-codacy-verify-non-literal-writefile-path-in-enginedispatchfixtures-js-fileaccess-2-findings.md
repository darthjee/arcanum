# Issue: Codacy: verify non-literal writeFile path in engineDispatchFixtures.js (FileAccess, 2 findings)

## Description

Codacy's ESLint security scan (`ESLint8_security_detect-non-literal-fs-filename`, subcategory FileAccess, priority High) still flags two `writeFile` calls in `core/spec/support/fixtures/engineDispatchFixtures.js` (lines 22 and 36) for using a non-literal path argument.

This is a **repeat of issue #460**. That issue investigated the same two findings, concluded `dir` is always a trusted, test-controlled temp directory (never external input), and its fix (PR #468) added explanatory rationale comments above both `writeFile` calls. However, PR #468 explicitly documented that it could **not** apply real Codacy-side suppression — no available tool could write a pattern-level or per-finding ignore rule, and this repo has no `.codacy.yml`/`.codacy.yaml` config file. It flagged the actual suppression (via the Codacy dashboard, `app.codacy.com/gh/darthjee/arcanum` → Code Patterns, or per-finding ignore) as a manual follow-up for a human with Codacy admin access.

That manual step was never done. Confirmed via the Codacy SRM API in this session: the two specific findings for this file are still open (`status: OnTrack`), unaffected by the comment-only fix:
- https://app.codacy.com/p/883699/issues/index?resultDataId=131532134675
- https://app.codacy.com/p/883699/issues/index?resultDataId=131532134676

Comments in source code have no effect on Codacy's own hosted scan — only a dashboard-level pattern/path ignore, a per-finding ignore, or a `.codacy.yml` config change actually suppresses it there. No Codacy MCP tool available in this session can write such a suppression; it currently requires a human with dashboard/admin access.

## Problem

Re-litigating this file-by-file wastes effort: another code-only fix (more comments, or restructuring the `writeFile` calls) will not close these findings, because the rule fires on any non-literal filename argument regardless of how well-reasoned or validated the path construction is, and the local `core/eslint.config.mjs` doesn't even run `eslint-plugin-security` — the finding exists purely in Codacy's own hosted analysis. Without addressing the finding at the tool level (dashboard or repo config), this issue will keep resurfacing as a "new" Codacy finding indefinitely.

## Expected Behavior

- Codacy no longer analyzes `core/spec/support/**` (fixtures, factories, and utils), durably closing the two open findings for `engineDispatchFixtures.js` (lines 22, 36) and preventing the same non-literal-path false positive from resurfacing as new issues for the other files noted in #460 (e.g. `gitFixtureRepo.js`, `autoFixAllCheckoutFromMainParitySetup.js`).
- The exclusion and its reasoning are documented (e.g. a comment in `.codacy.yml`) so a future contributor understands why these paths are exempt from analysis.
- No behavior change to the specs using these fixtures.

## Solution

Add a repo-root `.codacy.yml` with an `exclude_paths` entry covering `core/spec/support/**`:

```yaml
exclude_paths:
  - "core/spec/support/**"
```

This is broader than the two flagged findings — it also silences any other Codacy check (coverage, complexity, other security rules) on files under `core/spec/support/`, not just `detect-non-literal-fs-filename` — a deliberate tradeoff to close the whole recurring false-positive class from #460 at once, rather than file-by-file. Verify the exact key/schema against current Codacy documentation before committing (this session could not confirm it against a live Codacy config validator). The existing rationale comments in `engineDispatchFixtures.js` (and the other two files touched by #460) can stay as human-readable documentation even though they don't affect Codacy's scan.

Confirm on a subsequent Codacy analysis that the two open findings (linked above) close and no new findings appear under `core/spec/support/**`.

## Benefits

- Actually stops this Codacy finding from resurfacing as new issues.
- Keeps Codacy's security signal trustworthy by explicitly and durably marking known false positives, rather than leaving them open indefinitely.

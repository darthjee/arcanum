# Issue: Codacy: verify unencoded prUrl in HTML context in fakeGithubApiFetchPreload.js (XSS, 2 findings)

## Description

Codacy's ESLint security scan (SRM, tool `ESLint8_xss_no-mixed-html`, priority High) flags two occurrences in `core/spec/support/utils/fakeGithubApiFetchPreload.js` where a `prUrl` value flows into an HTML/JSON context without encoding.

**This is a re-flag of issue #461, already investigated once.** #461 (PR #469) confirmed these exact two call sites are a false positive — `prUrl` is a test-fixture string derived from `FAKE_FETCH_PR_URL`, never rendered as HTML or assigned to the DOM; the finding fires only because the property name `html_url` mirrors GitHub's own REST field name — and added explanatory comments above both lines documenting that conclusion.

No *functional* suppression was ever applied, though: `no-mixed-html` is not a rule enabled in this repo's own `core/eslint.config.mjs` (it is a Codacy SRM-side scanner rule), so a local `eslint-disable` comment would not affect it. The only real suppression path is marking the finding "Ignored" in Codacy's own dashboard/API, which #461's follow-up commit explicitly said was skipped because "no Codacy API/MCP credentials were available" at the time — so Codacy kept the finding live and it has now resurfaced as a new issue.

### Findings

| File | Line | Message |
|------|------|---------|
| `core/spec/support/utils/fakeGithubApiFetchPreload.js` | 112 | Unencoded input 'prUrl' used in HTML context (`JSON.stringify([{ number: Number(prNumber), title: prTitle, html_url: prUrl }])`) |
| `core/spec/support/utils/fakeGithubApiFetchPreload.js` | 171 | Unencoded input 'prUrl' used in HTML context (`html_url: prUrl,`) |

## Problem

Without an actual suppression (Codacy-side ignore, since no local ESLint rule applies), this false positive will keep resurfacing as a new Codacy-flagged issue indefinitely, even though the code-level explanation already exists in comments.

## Expected Behavior

- The two findings stop being re-flagged by Codacy going forward (not just documented again in comments).
- No behavior change to the specs that consume this fixture.
- The resolution approach taken (and why) is recorded for future reference, so a fourth re-flag does not repeat this same investigation from scratch.

## Solution

Now that Codacy MCP tools (`mcp__codacy__*`) are available in this environment (unlike at #461's resolution time), attempt to mark both findings as Ignored directly via Codacy's API/MCP, with a comment noting the false-positive rationale already documented in code. If that is not actually possible (e.g. credentials still unavailable, or the MCP tools don't expose an "ignore this finding" action), fall back to leaving the existing explanatory comments as the documented resolution and closing this as a known, expected re-flag.

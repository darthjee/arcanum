# Node Plan: Investigate Codacy suppression for XSS false positive in fakeGithubApiFetchPreload.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Confirm the exact flagged lines](node/01-confirm-flagged-lines.md)
- [02 — Mark both findings Ignored in Codacy](node/02-mark-findings-ignored.md)
- [03 — Add explanatory in-code comments](node/03-add-explanatory-comments.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`) — confirms no behavioral change to the fake-fetch mocks.
- `core`: `yarn lint` (CI job: `checks`) — confirms the added comments don't break lint (no ESLint rule is being suppressed locally; this repo's own ESLint config doesn't include `eslint-plugin-xss`).

## Notes

- Scope is limited to the two currently-open findings only. Two other look-alike `html_url: <non-literal>` assignments in this same file (`prCreateUrl` in `auto-fix-issue-github` mode, and a second `prUrl` occurrence in the same mode) are **not** currently flagged by Codacy and are deliberately left untouched — do not preemptively comment or suppress them.
- The two open findings' exact line numbers weren't resolvable via the Codacy MCP API used during discussion (it exposes each finding's title/category/priority/dashboard URL, not source line numbers). Step 01 below resolves this before any change is made.
- Both findings' dashboard URLs (for reference): `https://app.codacy.com/p/883699/issues/index?resultDataId=131530704297` and `https://app.codacy.com/p/883699/issues/index?resultDataId=131530705345`.
- `eslint-plugin-xss` is not installed in this repo and `no-mixed-html` is not configured in `core/eslint.config.mjs` — an `eslint-disable` comment would have no effect on the repo's own ESLint run and would not silence Codacy's hosted SRM finding either. Do not use one.
- No `.codacy.yml` or other repo-level Codacy config file exists in this repo; nothing indicates one should be introduced for this fix.

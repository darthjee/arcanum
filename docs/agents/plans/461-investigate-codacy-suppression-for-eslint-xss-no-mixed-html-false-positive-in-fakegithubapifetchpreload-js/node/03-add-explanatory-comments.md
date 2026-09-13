# Add explanatory in-code comments

Add a short comment directly above each of the two confirmed flagged `html_url: prUrl` assignments (from Step 01) in `core/spec/support/utils/fakeGithubApiFetchPreload.js`, explaining why it's a false positive, so future contributors don't strip the suppression without checking. Mirror the comment style used for issue #460's fix in `engineDispatchFixtures.js`/`gitFixtureRepo.js`/`autoFixAllCheckoutFromMainParitySetup.js` — a plain code comment, no `eslint-disable` directive (there is no such rule configured in `core/eslint.config.mjs` for it to disable).

Example shape:

```js
// `prUrl` is always a test-fixture string derived from an env var
// (FAKE_FETCH_PR_URL), never rendered as HTML or assigned to the DOM —
// this is a known false positive for Codacy's XSS/"unencoded input
// used in HTML context" finding, which flags this only because the
// property name happens to contain "html" (mirroring GitHub's own
// html_url field). Marked ignored in Codacy; see issue #461.
html_url: prUrl,
```

Adjust wording per site (the `wait-ci` mode's array-literal assignment vs. the `github` mode's object-literal assignment) but keep the same rationale and issue reference.

Do not add a comment to the two unflagged look-alike sites (`prCreateUrl`, and the other `prUrl` in `auto-fix-issue-github` mode) — they're out of scope per [node.md](../node.md)'s Notes.

After adding the comments, run `yarn test` and `yarn lint` in `core/` to confirm no behavioral or lint regression.

## Files to Change

- `core/spec/support/utils/fakeGithubApiFetchPreload.js` — add one explanatory comment above each of the two confirmed flagged `html_url: prUrl` assignments.

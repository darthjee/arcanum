# node Plan: Codacy: PMD UnnecessaryBlock cluster — core/lib/services, context, core (5 findings, 4 files)

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Confirm the `.codacy.yml` exclusion already covers all 4 files

Read `.codacy.yml` and confirm its `# #514 — core/lib/services, core/lib/context, core/lib/core (4 files)` block lists all 4 affected paths verbatim:
- `core/lib/context/RepoContextFactory.js`
- `core/lib/core/dispatcher.js`
- `core/lib/services/IssueStateService.js`
- `core/lib/services/PrMonitor.js`

No edit needed if all 4 are present (they were added by commit `47f2422`, PR #529). If any is missing, add it under the existing `#514` comment block, matching the format of the surrounding entries.

### Step 2 — Independently verify zero real lone-block violations

From `core/`, run:

```bash
npx eslint --rule '{"no-lone-blocks":"error"}' \
  lib/context/RepoContextFactory.js \
  lib/core/dispatcher.js \
  lib/services/IssueStateService.js \
  lib/services/PrMonitor.js
```

Confirm the output reports 0 errors for `no-lone-blocks` across all 4 files (other pre-existing `jsdoc/*` warnings are unrelated and out of scope). This is independent confirmation — via a real ESLint rule, not just the Codacy exclusion — that none of PMD's 5 flagged findings are genuine unnecessary blocks that should actually be removed.

No production code changes are made in either step.

## Files to Change

- `.codacy.yml` — verify only; edit only if Step 1 finds a missing path (unexpected, since commit `47f2422` already added it).

## CI Checks

- `core`: `yarn lint` (CI job: `lint`) — unaffected, since no source files change.
- `core`: `yarn test` (CI job: `test`) — unaffected, since no source files change.

## Notes

- This is the 6th and final cluster in a repo-wide PMD `UnnecessaryBlock` sweep (see #509–#513). Like #510/#511/#512, it resolves via the exclusion already in place rather than any code edit.
- If Step 2 ever finds a real violation (would contradict this plan's premise, given the same exclusion already covers 82 other files across the other 5 clusters without incident), stop and re-open discussion on the issue rather than silently removing a block that might be required syntax (PMD's ecmascript parser is known to misidentify `try {` openers, destructuring assignments, returned object literals, and required `switch`-case blocks as "unnecessary").

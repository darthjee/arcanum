# node Plan: Codacy: duplication cluster — commit-command spec quartet (auto-new-issue/auto-plan-issue/auto-fix-issue/auto-fix-all) (~30 clone groups, 4 files)

Main plan: [plan.md](plan.md)

## Overview
Codacy flags ~30 clone groups and 500+ duplicated lines across four "commit the artifact and stage it" specs. Two duplication patterns exist at different strengths per file: a shared repo/git-mock bootstrap block (near-identical in 2 of 4 files, close-but-divergent in the other 2), and a repeated commit-message assertion block (repeats 5-6 times per scenario in 3 of 4 files; only once in the fourth). Extract both into `core/spec/support/factories/commitCommandFixtures.js`, following this repo's existing factory-function convention (there is no Jasmine shared-example/shared-context mechanism to build on — see `autoFixIssueGithub.js` for the established pattern).

## Context
- `AutoNewIssueCommitIssue_spec.js` and `AutoPlanIssueCommitPlan_spec.js`: setup blocks (~lines 1-68) are byte-identical aside from the class name/path; both fake `add`/`commit`/`branch`/`push`.
- `AutoFixIssueCommitChange_spec.js`: same `fakeConfigChain` shape, but `fakeExecFileAsync` omits the `add` branch (this command never stages) and has extra top-level constants (`TYPE`/`SCOPE`/`SUBJECT`/`AGENT`).
- `AutoFixAllCleanupArtifacts_spec.js`: diverges most — fakes `ls-files`/`rm`/`diff` instead of `add`, has **no** `fakeConfigChain` (this command has no agent parameter, always hardcodes `"architect"`), and its `beforeEach`/`afterEach` build a `PLAN_DIR` fixture instead of `filePath`/`planDir`. It also has only **one** commit-assertion block (not 5-6), so it does not use the repeated-assertion helper.
- The repeated commit-assertion block (present in the first three files) varies not just on the expected message, but also on `fakeConfigChain` inputs (`agentEmail`, `omitModelCoauthor`), whether a template file is written to disk first, the matcher type (`toEqual` vs. `toContain`), and sometimes an extra assertion on `configChain.read`'s call args. Any shared helper must parameterize all of these, not just the final matcher.

## Steps

- [01 — Add commitCommandFixtures factory and assertion helper](node/01-add-commit-command-fixtures.md)
- [02 — Refactor AutoNewIssueCommitIssue_spec.js](node/02-refactor-auto-new-issue-commit-issue-spec.md)
- [03 — Refactor AutoPlanIssueCommitPlan_spec.js](node/03-refactor-auto-plan-issue-commit-plan-spec.md)
- [04 — Refactor AutoFixIssueCommitChange_spec.js](node/04-refactor-auto-fix-issue-commit-change-spec.md)
- [05 — Refactor AutoFixAllCleanupArtifacts_spec.js (setup factory only)](node/05-refactor-auto-fix-all-cleanup-artifacts-spec.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`) — must still pass with no reduction in asserted behavior.
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking) — Codacy's duplication score for these four files should drop substantially.

## Notes
- Do the setup-factory refactor (step 01) first, then adapt each spec incrementally (steps 02-05), running `yarn test` after each spec's refactor to catch regressions early rather than only at the end.
- Preserve every existing scenario's coverage exactly — including the arrange-side variations (config values, template fixtures) identified above, not just the final expected-message string.
- Naming (`commitCommandFixtures.js`, exported function names) may be adjusted during implementation as long as the factory-function convention (not a shared-example macro) is followed.

# Issue: Codacy: duplication cluster — commit-command spec quartet (auto-new-issue/auto-plan-issue/auto-fix-issue/auto-fix-all) (~30 clone groups, 4 files)

## Description
Codacy's duplication analysis flags heavy cross-file cloning across four "commit the artifact and stage it" specs under `core/spec/lib/commands/`:

- `auto-new-issue/AutoNewIssueCommitIssue_spec.js`
- `auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`
- `auto-fix-issue/AutoFixIssueCommitChange_spec.js`
- `auto-fix-all/AutoFixAllCleanupArtifacts_spec.js`

Codacy reports ~30 clone groups and a combined duplication score over 900 across these four files, with 500+ duplicated lines estimated.

## Problem
Two duplication patterns exist, at different strengths per file (confirmed by reading all four specs in full):

- **Shared repo/git-mock bootstrap** (the first ~70 lines of each file): `AutoNewIssueCommitIssue_spec.js` and `AutoPlanIssueCommitPlan_spec.js` are byte-identical aside from the class name/path. `AutoFixIssueCommitChange_spec.js` is close but its git-exec fake omits the `add` subcommand (this command never stages) and has different top-level constants. `AutoFixAllCleanupArtifacts_spec.js` diverges more: it fakes `ls-files`/`rm`/`diff` instead of `add`, has **no** `fakeConfigChain` at all (this command has no agent parameter — it always hardcodes "architect"), and its `beforeEach`/`afterEach` differ (a `PLAN_DIR` fixture instead of `filePath`/`planDir`).
- **Repeated commit-message assertion block**: in the first three files, each scenario repeats a ~7-8 line block that builds `execFileAsync`/`configChain`, runs the command, locates the `commit` call, and asserts on the message (and sometimes on `configChain.read`). What varies isn't just the expected message — `fakeConfigChain` inputs (`agentEmail`, `omitModelCoauthor`), whether a template file is written first, and the matcher type (`toEqual` vs. `toContain`) all vary too. **`AutoFixAllCleanupArtifacts_spec.js` has only one such block** (single-scenario, hardcoded message), so the "repeats 5-6 times per file" pattern does not apply to it.

The test framework is Jasmine, which has no built-in shared-example/shared-context mechanism. This repo's existing convention for shared spec setup is exported factory functions under `core/spec/support/factories/` (e.g. `autoFixIssueGithub.js`), not an RSpec-style shared-example macro.

## Expected Behavior / Acceptance Criteria
- [ ] A composable factory under `core/spec/support/factories/` (e.g. `commitCommandFixtures.js`) builds the shared repo/git-mock bootstrap, parameterized over which git subcommands to stub (`add` vs. `ls-files`/`rm`/`diff`) and with `configChain` optional, and is used by all four specs.
- [ ] A plain assertion helper function (not a Jasmine shared-example macro) replaces the repeated commit-assertion blocks in `AutoNewIssueCommitIssue_spec.js`, `AutoPlanIssueCommitPlan_spec.js`, and `AutoFixIssueCommitChange_spec.js`, parameterized over the varying arrange-side inputs (`configChain` overrides, optional template fixture) and the assert-side matcher — not just the final expected string.
- [ ] `AutoFixAllCleanupArtifacts_spec.js` uses the shared setup factory (parameterized for its divergent subcommand set and missing `configChain`) but is **not** forced onto the repeated-assertion helper, since it has only one commit-assertion block.
- [ ] All four specs pass with no reduction in asserted behavior, including the arrange-side variations identified above (config values, template fixtures), not just the final message matcher.
- [ ] Codacy's duplication score for these four files drops substantially after the fix lands.

## Solution
- Add `core/spec/support/factories/commitCommandFixtures.js` (naming may be adjusted during implementation) with a composable builder for the shared repo/git-mock bootstrap, following this repo's existing factory-function convention rather than introducing a shared-example mechanism.
- Add a small plain assertion helper for the repeated "find the commit call and assert on its message" logic, taking the varying config/fixture/matcher inputs as parameters.
- Apply both to `AutoNewIssueCommitIssue_spec.js`, `AutoPlanIssueCommitPlan_spec.js`, and `AutoFixIssueCommitChange_spec.js`.
- Apply only the setup factory (not the assertion helper) to `AutoFixAllCleanupArtifacts_spec.js`, parameterized for its divergent subcommand set and missing `configChain`.

## Benefits
- Removes the ~30 Codacy-flagged clone groups and 500+ duplicated lines across the four spec files.
- Establishes a reusable, convention-consistent factory for future "commit an artifact" command specs.
- Preserves full existing test coverage, including arrange-side variations, while reducing maintenance burden of near-identical boilerplate.

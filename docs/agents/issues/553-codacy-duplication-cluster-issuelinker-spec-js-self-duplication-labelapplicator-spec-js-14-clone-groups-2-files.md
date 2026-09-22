# Issue: Codacy: duplication cluster — IssueLinker_spec.js self-duplication + LabelApplicator_spec.js (14 clone groups, 2 files)

## Description
Codacy reports 14 clone groups (~40 duplicated lines) across `core/spec/lib/utils/issue/IssueLinker_spec.js` and `core/spec/lib/utils/issue/LabelApplicator_spec.js`. The fix adds a shared `execFileAsync` fake. Three other specs hand-roll the same dispatcher shape for `git`, so they move onto the shared fake too: `core/spec/support/factories/commitCommandFixtures.js`, `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` and `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js`. Only test code changes; nothing under `core/lib/` is touched.

## Problem
- **IssueLinker_spec.js repeats itself.** Every test repeats the same arrange/act block: `fakeExecFileAsync(...)` → `new IssueLinker({ execFileAsync })` → `spyOn(process.stderr, 'write')` → `await issueLinker.link('1', '42', 'New issue', REPO_REF, ...)`. Three `--as-subissue` fallback tests (node id missing, node-id lookup throws, GraphQL mutation fails) also assert the exact same `Warning: could not link issue #42 as a native sub-issue of #1 …` message and differ only in the fake's options. Two of them also assert that the mutation was never attempted.
- **The dispatcher is copied across files.** Five spec files each hand-roll an `execFileAsync` fake with the same skeleton:
  - a `jasmine.createSpy('execFileAsync').and.callFake`
  - a `cmd !== '<gh|git>'` guard that throws `unexpected command`
  - one branch per subcommand that returns `{ stdout }` or throws when a failure flag is set
  - a final `unexpected <gh|git> invocation` throw

  `LabelApplicator_spec.js` also repeats the same arrange/act block in every test.

## Expected Behavior
- In `IssueLinker_spec.js`, the three identical sub-issue link-failure tests become one parameterized `it.each`/`forEach` test. An `expectsMutation`-style column decides whether a case also asserts that the `addSubIssue` mutation was skipped: the two node-id cases do, the GraphQL-failure case doesn't.
- One command-agnostic fake at `core/spec/support/utils/` owns the dispatcher skeleton. All five files build their fakes from it and keep only their own subcommand routes and failure flags.
- Every affected spec passes. Coverage and assertions stay the same: same messages, same argv expectations, same error shapes (e.g. `error.code = 1`, `error.stdout`).

## Solution
1. Add `core/spec/support/utils/fakeExecFileAsync.js`. It takes the expected command (`'gh'` / `'git'`) and an ordered list of routes, each a `match(args)` predicate plus a `respond(args, options)` handler that returns `{ stdout, ... }` or throws. It returns the `execFileAsync` jasmine spy, including the `unexpected command: <cmd>` and `unexpected <cmd> invocation: <args>` guards. Handlers get the call's `options` so `commitCommandFixtures.js` can keep returning `__input: options.input`. Stateful fakes, like its `staged` flag, keep their state in the caller's closure.
2. Rewrite each file's fake as a thin wrapper over the helper that declares only its routes. Keep the existing exported/local names (`fakeExecFileAsync`, `fakeGitExecFileAsync`) and their option signatures, so the test bodies don't change:
   - `IssueLinker_spec.js` (gh)
   - `LabelApplicator_spec.js` (gh)
   - `commitCommandFixtures.js` (git)
   - `AutoFixIssueCreateBranch_spec.js` (git)
   - `AutoFixIssueMergeMain_spec.js` (git)
3. In `IssueLinker_spec.js`, replace the three sub-issue link-failure tests with one parameterized test over `{ fakeOptions, expectsMutation }`.
4. In `IssueLinker_spec.js` and `LabelApplicator_spec.js`, add a small per-file arrange/act helper that removes the repeated construct → spy on stderr → call block.
5. Run `core`'s full spec suite and lint.

## Benefits
- Removes the 14 Codacy clone groups for this pair, plus the matching dispatcher clones in the three `git` fakes.
- New collaborators that shell out to `gh` or `git` get a ready-made fake instead of copying the dispatcher again.

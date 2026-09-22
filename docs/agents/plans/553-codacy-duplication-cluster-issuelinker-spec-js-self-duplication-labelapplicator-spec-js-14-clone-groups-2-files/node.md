# Node Plan: Codacy: duplication cluster — IssueLinker_spec.js self-duplication + LabelApplicator_spec.js (14 clone groups, 2 files)

Main plan: [plan.md](plan.md)

## Overview
This plan adds one command-agnostic `execFileAsync` jasmine fake and migrates every hand-rolled `gh`/`git` dispatcher fake onto it. It also removes the self-duplication in `IssueLinker_spec.js` and the repeated setup in `LabelApplicator_spec.js`. Only files under `core/spec/` change; nothing under `core/lib/` is touched.

## Context
Codacy reports 14 clone groups (~40 lines) across `core/spec/lib/utils/issue/IssueLinker_spec.js` and `core/spec/lib/utils/issue/LabelApplicator_spec.js`. Both files, plus three `git` fakes (`core/spec/support/factories/commitCommandFixtures.js`'s `fakeGitExecFileAsync`, `AutoFixIssueCreateBranch_spec.js` and `AutoFixIssueMergeMain_spec.js`), repeat the same skeleton:
- `jasmine.createSpy('execFileAsync').and.callFake(async (cmd, args[, options]) => ...)`
- a `cmd !== '<gh|git>'` guard that throws `unexpected command: <cmd>`
- one `if` branch per subcommand
- a final `unexpected <gh|git> invocation: <JSON args>` throw

The user decided that:
- all five files move onto the shared helper;
- the helper lives in `core/spec/support/utils/`;
- the three sub-issue link-failure tests become one `it.each`-style table with an `expectsMutation` column.

## Steps

- [01 — Add the shared execFileAsync fake](node/01-add-shared-exec-fake.md)
- [02 — Migrate the gh fakes in the issue specs](node/02-migrate-gh-fakes.md)
- [03 — Migrate the git fakes](node/03-migrate-git-fakes.md)
- [04 — Parameterize IssueLinker's link-failure tests and extract arrange/act helpers](node/04-parameterize-and-extract-helpers.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn duplication` (CI job: `checks`, non-blocking). Use it to confirm the clone groups are gone.

## Notes
- Keep every existing assertion, message string and error shape (`error.code = 1`, `error.stdout = mergeStdout`, `__input: options.input`) exactly as they are. Only the fake plumbing and test layout change.
- Keep the current exported/local function names and option signatures (`fakeExecFileAsync({...})` in each spec, `fakeGitExecFileAsync({...})` in `commitCommandFixtures.js`), so callers and test bodies elsewhere don't need edits.
- Jasmine has no built-in `it.each`. Use a `[...].forEach(({ ... }) => it(...))` table, following the pattern other specs in `core/spec` already use.
- The helper file must follow the repo's JSDoc/eslint conventions, like its neighbours `fakeFetch.js` and `fakeGhBin.js`.

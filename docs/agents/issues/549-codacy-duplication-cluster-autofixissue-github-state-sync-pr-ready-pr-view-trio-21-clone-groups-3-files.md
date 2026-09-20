# Codacy: duplication cluster — AutoFixIssue Github state-sync/pr-ready/pr-view trio (21 clone groups, 3 files)

## Context

Three specs share a common 4-6 line "github state check" setup/assertion fragment:

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubStateSync_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrReady_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`

`AutoFixIssueGithubStateSync_spec.js` additionally self-duplicates a "sync state" block 3 times internally (roughly lines 60-64/101-105/117-121/133-137). Codacy reports 21 clone groups and roughly 45 duplicated lines across this trio.

## What needs to be done

- Add a shared `githubStateFixture()` builder.
- Add a shared `syncsGithubState(from, to)` shared example, used by all three files and internally within the state-sync spec to collapse its repeated blocks.

## Acceptance criteria

- [ ] A `githubStateFixture()` builder and `syncsGithubState(from, to)` shared example exist and are used by all three listed specs.
- [ ] The duplicated setup/assertion fragments (including internal repetition in `AutoFixIssueGithubStateSync_spec.js`) are removed in favor of the shared helpers.
- [ ] All three specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this trio drops substantially after the fix lands.

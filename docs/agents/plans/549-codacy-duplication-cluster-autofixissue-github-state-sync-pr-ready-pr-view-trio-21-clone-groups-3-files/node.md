# Node Plan: Codacy: duplication cluster — AutoFixIssue Github state-sync/pr-ready/pr-view trio (21 clone groups, 3 files)

Main plan: [plan.md](plan.md)

## Overview

Three specs under `core/spec/lib/commands/auto-fix-issue/` share a near-identical "persist PR state + sync GitHub labels" setup/assertion fragment, and `AutoFixIssueGithubStateSync_spec.js` additionally repeats a smaller "sync state" arrange/act block internally about five times. `createAutoFixIssueGithub()` (`core/spec/support/factories/autoFixIssueGithub.js`) already defaults `issueStateService`/`issueTagger` to jasmine-spy shapes, but most of the repeated blocks re-declare those same defaults inline instead of relying on/overriding just the parts each test needs.

Add a `githubStateFixture()` builder plus a `syncsGithubState(from, to)`-style shared example under `core/spec/support/sharedExamples/`, following the existing `registerXSharedExamples(fn)` convention (see `mergeBodyResolverSharedExamples.js`), then adopt it in all three specs.

## Context

- `AutoFixIssueGithubStateSync_spec.js` (`#_persistPrState`, `#_syncPrLabelsAndState`) repeatedly builds `issueTagger`/`issueStateService` spy objects and asserts the same `issueStateService.set('5', 'pr_url'/'pr_id', ...)` / `issueTagger.mutateTag('5', REPO, 'add', 'pr')` / `issueStateService.setJson('5', 'tags', ...)` shapes.
- `AutoFixIssueGithubPrReady_spec.js` and `AutoFixIssueGithubPrView_spec.js` each have one test ("persists pr state and syncs labels/tags when on an issue-<id> branch") that duplicates the same setup + assertions, plus paired "is a no-op / does not persist off an issue-<id> branch" tests.
- All three specs import `createAutoFixIssueGithub`/`REPO` from `core/spec/support/factories/autoFixIssueGithub.js` — the shared example should build on top of that factory, not replace it.

## Steps

- [01 — Add shared github-state-sync fixture and example](node/01-add-shared-fixture-and-example.md)
- [02 — Collapse internal duplication in AutoFixIssueGithubStateSync_spec.js](node/02-collapse-state-sync-internal-duplication.md)
- [03 — Adopt the shared example in the pr-ready/pr-view specs](node/03-adopt-shared-example-in-pr-ready-and-pr-view.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Keep `it` names roughly aligned with today's so coverage/intent stay legible in the shared example's assertions — exact wording is a judgment call for whoever implements this.
- The issue's suggested names (`githubStateFixture()`, `syncsGithubState(from, to)`) are a starting point, not a hard requirement — adjust signatures as needed to fit what the three specs actually need to vary (branch, PR number/url, initial tags, expected persisted state/tags).
- Preserve the existing `_persistPrState`/`_syncPrLabelsAndState` no-op-off-branch and best-effort-tolerates-failure test cases as-is; only the state-sync assertion/setup fragments are candidates for collapsing into the shared example.

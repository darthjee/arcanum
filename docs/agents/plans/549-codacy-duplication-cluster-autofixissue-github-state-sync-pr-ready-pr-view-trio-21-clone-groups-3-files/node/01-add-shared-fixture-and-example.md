# Add shared github-state-sync fixture and example

Create `core/spec/support/sharedExamples/githubStateSyncSharedExamples.js`, mirroring the shape of `core/spec/support/sharedExamples/mergeBodyResolverSharedExamples.js` (a `register...SharedExamples(...)` export registering flat `it`s, no `describe` wrapper of its own — the JSDoc block documents what varies between call sites).

Provide two exports:

- `githubStateFixture(overrides = {})` — a small builder that returns the common `{ branch, githubClient, issueTagger, issueStateService }` shape the trio's tests wire into `createAutoFixIssueGithub(...)`, defaulting to an `issue-5` branch with jasmine-spy `issueTagger`/`issueStateService` collaborators matching the factory's own defaults (`mutateTag`/`fetchLabels`/`addLabel`, `set`/`setJson`), and letting a caller override individual fields (e.g. a specific `fetchLabels` resolution, a `branch: 'main'` no-op case, or an `issueStateService.set` that rejects).
- `syncsGithubState(exercise, expectations)` (or `registerSyncsGithubStateSharedExamples(...)`, matching the file's naming convention) — a shared example registering the "persists pr_url/pr_id and syncs the `pr` tag + refreshed labels when on an issue-<id> branch" scenario (and its "is a no-op off an issue-<id> branch" counterpart) against a caller-supplied `exercise(github)` callback, so `#_persistPrState`/`#_syncPrLabelsAndState`, `#prReady`, and `#prView` can each plug in their own action while sharing the assertion shape.

Keep this fixture/example additive only — do not touch any of the three spec files in this step.

## Files to Change

- `core/spec/support/sharedExamples/githubStateSyncSharedExamples.js` — new file: `githubStateFixture()` builder + `syncsGithubState`/`registerSyncsGithubStateSharedExamples` shared example.

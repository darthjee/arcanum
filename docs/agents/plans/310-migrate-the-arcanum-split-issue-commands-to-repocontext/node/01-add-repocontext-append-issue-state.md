# Add RepoContext#appendIssueState passthrough

Add the one write-side passthrough that lets the migrated
`ArcanumSplitIssueCreateSubIssue` reach `IssueStateService#appendJson` through
the injected `RepoContext` instead of building its own. This step is
independent of the command migrations and leaves the tree green on its own.

## What to do

1. In `core/lib/context/RepoContext.js`, add a method mirroring the existing
   `getIssueState` delegate:

   ```js
   /**
    * @param {string} id - the numeric issue id.
    * @param {string} field - the state field's name.
    * @param {string} jsonValue - the raw JSON text to parse and append.
    * @returns {Promise<void>} resolves once the state file is written —
    *   see `IssueStateService#appendJson`.
    */
   async appendIssueState(id, field, jsonValue) {
     return this._issueStateService.appendJson(id, field, jsonValue);
   }
   ```

   Place it directly after `getIssueState` so read/write delegates sit together.
   Match the surrounding JSDoc style.

2. In `core/spec/lib/context/RepoContext_spec.js`, add a `describe('#appendIssueState')`
   block next to the `#getIssueState` one, asserting it delegates to
   `issueStateService.appendJson` with `(id, field, jsonValue)` and returns its
   result. Use the existing `newContext({ issueStateService: { appendJson } })`
   override pattern (extend `newContext`'s default `issueStateService` stub with
   an `appendJson: jasmine.createSpy()` so other specs in the file keep working).

3. In `core/spec/support/factories/repoContextFactory.js`, add
   `appendJson: jasmine.createSpy()` to the `issueStateService` mock (alongside
   the existing `get: jasmine.createSpy()`), so `createRepoContextMock()` stays
   a faithful mirror of `RepoContext`'s API for future specs.

## Files to Change

- `core/lib/context/RepoContext.js` — add the `appendIssueState(id, field, jsonValue)` passthrough after `getIssueState`.
- `core/spec/lib/context/RepoContext_spec.js` — add `#appendIssueState` delegation test; give `newContext`'s default `issueStateService` stub an `appendJson` spy.
- `core/spec/support/factories/repoContextFactory.js` — add `appendJson: jasmine.createSpy()` to the `issueStateService` mock.

# Codacy: duplication cluster — IssueClient_spec.js internal self-duplication (23 clone groups, 1 file)

## Context

`core/spec/lib/utils/github/IssueClient_spec.js` repeats an identical 8-10 line GraphQL/REST request-and-assert block four times at regular offsets (roughly lines 71-80/106-116/145-152/177-186 and 82-89/118-125/154-161/188-195), one per API operation, with only the operation name/query varying. Codacy reports 23 clone groups and roughly 60 duplicated lines within this file.

## What needs to be done

- Parameterize the four operations (fetch/create/comment/close, etc.) through an `it.each` table.
- Drive the table with a single `issueClientCallAssertion(operation)` helper.

## Acceptance criteria

- [ ] The repeated per-operation request/assert blocks in `IssueClient_spec.js` are replaced by a single parameterized test covering all four operations.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.

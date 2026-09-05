# node Plan: Split spec GithubIssue

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared spec helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Split `#fetch` into `GithubIssueFetch_spec.js`](node/02-split-fetch-spec.md)
- [03 — Split `#info` into `GithubIssueInfo_spec.js`](node/03-split-info-spec.md)
- [04 — Split `#create` into `GithubIssueCreate_spec.js` and delete the original](node/04-split-create-spec-and-delete-original.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- No change to `core/lib/commands/shared/GithubIssue.js` or any collaborator
  (`IssueClient`, `IssueStateService`, `Origin`, `GithubToken`, `Tags`) — every `it` moves
  verbatim, assertions unchanged.
- Do the factory extraction first (step 01) so steps 02–04 can each import from it directly,
  matching the commit order used for the prior spec-split issues (#358–#361): extract
  helpers, then split one new spec file per commit, deleting the original only in the last
  step once nothing else still needs it.
- `core/spec/support/fixtures/{github_issue_success,github_issue_not_found,github_issue_create_success}.json`
  already exist and don't move — only the two inline helper functions move into the factory.
- `bin/githubIssueInfoParity_spec.js` / `bin/githubIssueCreateParity_spec.js` are untouched —
  out of scope per the issue.

# node Plan: Extract IssueClient from IssueTagger/GithubIssue/AutoFixAllReplyComment

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add IssueClient](node/01-add-issueclient.md)
- [02 — Convert IssueTagger to RepoContext-bound](node/02-convert-issuetagger.md)
- [03 — Convert AutoFixAllReplyComment to RepoContext-bound](node/03-convert-autofixallreplycomment.md)
- [04 — Update AutoFixAllGithub's IssueTagger wiring](node/04-update-autofixallgithub-issuetagger-wiring.md)
- [05 — Update AutoFixAllQueue's IssueTagger wiring](node/05-update-autofixallqueue-issuetagger-wiring.md)
- [06 — Update GithubIssue to use a per-call IssueClient internally](node/06-update-githubissue-internal-issueclient.md)

## CI Checks

- `core`: `yarn test` (CircleCI job: `test`)
- `core`: `yarn lint` (CircleCI job: `checks`)

## Notes

- **`GithubIssue` deliberately does NOT get the `RepoContext`-bound treatment** — its public API (`fetch(repoPath, id)`/`create(repoPath, title, file)`/`info(repoPath)`) stays exactly as-is. This was settled during discussion: `core/bin/arcanum`'s dispatch table constructs it with a zero-argument constructor and passes `repoPath` positionally into the method (`new GithubIssue().create(repoPath, title, file)`), the same convention every other already-migrated command in that table uses (e.g. `AutoFixAllGithub`, which already solves an identical `RepoContext`-needing problem via a private per-call `_prOperations(repoPath)` helper, never constructor injection). Step 06 gives `GithubIssue` the same internal-only treatment.
- Steps 01–03 must land before 04–05 (`AutoFixAllGithub`/`AutoFixAllQueue` depend on `IssueTagger`'s new constructor shape). Step 06 (`GithubIssue`) is independent and can happen any time after Step 01.
- Preserve every class's current externally-observed stdout/exit-code behavior — this is an internal layering refactor, not a behavior change. `IssueTagger`/`AutoFixAllReplyComment`'s specs are expected to change their *mocks* (context-bound shape) but not their assertions on observable output.

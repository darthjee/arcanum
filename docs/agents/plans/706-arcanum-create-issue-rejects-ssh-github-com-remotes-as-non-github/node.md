# Plan: arcanum-create-issue rejects ssh.github.com remotes as non-GitHub

Issue: [706-arcanum-create-issue-rejects-ssh-github-com-remotes-as-non-github.md](../../issues/706-arcanum-create-issue-rejects-ssh-github-com-remotes-as-non-github.md)

## Overview
`/arcanum-create-issue`'s GitHub preflight rejects `ssh://git@ssh.github.com:443/<owner>/<repo>.git` remotes because it requires the domain to be exactly `'github.com'`. `Origin#resolveWithRef` has the same strict check, so it builds a domain-qualified `ssh.github.com/<owner>/<repo>` repoRef, which then reaches `gh -R` (`IssueLinker`, `IssueTagger`). Add one shared normalization in `Origin.js`, use it in all three Node places, and remove `FinishReport`'s private alias map.

## Context
- `Origin#resolve()` returns the raw host. Its `domain` is printed verbatim as `DOMAIN=` by `ResolveAndFetch` and `AutoFixIssueGithub#info`, matching bash `origin.sh` `get_domain`. **Keep `resolve()` returning the raw domain** so that output does not change.
- `FinishReport.js` already maps `ssh.github.com` → `github.com` with `WEB_DOMAIN_ALIASES`. `core/spec/bin/finishReportParity_spec.js` checks that the output matches the bash version byte for byte.
- Bash (`arcanum/_lib/origin.sh`, `finish_report_shell.sh`, `test_origin_resolution.sh`) is out of scope. Bash `get_repo_ref` keeps returning the domain-qualified form (issue #453). After this change, Node `resolveWithRef` will deliberately differ from it.

## Steps

- [01 — Add shared GitHub domain normalization to Origin](node/01-origin-normalization.md)
- [02 — Use the normalization in GithubPreflight](node/02-github-preflight.md)
- [03 — Replace FinishReport's local alias map](node/03-finish-report.md)

## CI Checks
- `core`: `npm test` and `npm run lint` (from `core/`), plus `npm run duplication` (CircleCI jobs that run with `working_directory: ~/project/core`)

## Notes
- Do not touch the bash files, and do not change `test_origin_resolution.sh`'s #453 assertion.
- `SpawnIssue` passes bare `repo` (not repoRef) to `gh -R`, so it is already correct for `ssh.github.com`. The fix only changes callers that use repoRef: `IssueTagger`, `GitHubTransport`/`GitHubLabelClient` messages, and anything else reading `resolveWithRef().repoRef`.
- Audit: grep `core/lib` for any other `'github.com'` comparisons. At planning time, the only ones were `GithubPreflight` and `Origin#resolveWithRef`. `GithubToken`'s `gh auth token --hostname github.com` is a fixed host and stays as is.

# Issue: arcanum-create-issue rejects ssh.github.com remotes as non-GitHub

## Problem
`/arcanum-create-issue` fails at its first step (GitHub preflight) when `origin` uses GitHub's SSH-over-443 endpoint:

```
$ git remote get-url origin
ssh://git@ssh.github.com:443/darthjee/arcanum.git

STATUS=error
ERROR=origin is not a GitHub remote: ssh.github.com/darthjee/arcanum
```

`ssh.github.com` is a valid GitHub host, but `core/lib/commands/arcanum-create-issue/GithubPreflight.js` compares the parsed domain strictly against `'github.com'`.

The same strict comparison exists in `Origin.resolveWithRef` (`core/lib/utils/git/Origin.js`), which therefore yields a domain-qualified repoRef `ssh.github.com/<owner>/<repo>` for such remotes. That repoRef is passed to `gh -R` (`IssueLinker`, `IssueTagger`), which would target the non-existent GitHub host `ssh.github.com`.

## Expected Behavior
- A remote on `ssh.github.com` (e.g. `ssh://git@ssh.github.com:443/<owner>/<repo>.git`) is treated as a GitHub remote, and `/arcanum-create-issue` proceeds normally.
- In Node, `Origin.resolveWithRef` returns a bare `<owner>/<repo>` repoRef for `ssh.github.com` remotes, same as for `github.com`.

## Solution
Node-only (`core/lib`); the bash side is out of scope.

- Add a shared GitHub-domain normalization in `core/lib/utils/git/Origin.js` (e.g. a static alias map / helper mapping `ssh.github.com` → `github.com`).
- `GithubPreflight`: compare the normalized domain against `github.com`.
- `Origin.resolveWithRef`: use the normalized domain when deciding whether repoRef is bare, so `ssh.github.com` remotes yield bare `<owner>/<repo>`. Whether `resolve()` itself returns the raw or normalized `domain` is left to the implementer, as long as callers that need the raw host keep working.
- `core/lib/commands/shared/FinishReport.js`: replace its local `WEB_DOMAIN_ALIASES` with the shared helper, keeping existing FinishReport specs and the bash-parity spec (`core/spec/bin/finishReportParity_spec.js`) green.
- Audit other `core/lib` code for the same `github.com`-only assumption.
- Specs: `GithubPreflight` accepts an `ssh.github.com` remote; `Origin.resolveWithRef` returns a bare repoRef for it; the shared helper's mapping.

### Out of scope
- Bash `arcanum/_lib/origin.sh` `get_repo_ref` stays as-is: it keeps returning the domain-qualified `ssh.github.com/<owner>/<repo>` that `arcanum/_lib/test_origin_resolution.sh` locks in (issue #453). After this change, Node `resolveWithRef` intentionally stops matching bash `get_repo_ref` for `ssh.github.com` remotes; update the `Origin` doc comment to say so.

## Benefits
- `/arcanum-create-issue`, and Node `gh -R` callers, work for users whose `origin` goes through SSH-over-443 (common behind restrictive firewalls).
- The `ssh.github.com` alias is defined once in Node instead of duplicated per command.

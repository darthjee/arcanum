# Parity tests

One file per subcommand under `core/spec/bin/autoFixIssueGithubParity/`, mirroring `autoFixAllGithubParity/`'s layout, plus a dedicated routing spec:

- **`info_spec.js`**: fixture repo with a known `origin` remote — compare `github_shell.sh info <repo>` against `core/bin/arcanum auto-fix-issue-github-info <repo>` for identical stdout/exit code.
- **`pr_create_spec.js`**: mocked/stubbed GitHub API layer (per this repo's existing parity-test convention for network-touching entrypoints — check how `autoFixAllGithubParity/pr_number_spec.js` or similar handles this, since `pr-create` hits real REST endpoints unlike `commit_change`'s pure-git precedent) — cover the happy path, missing-file error, and API-failure error text.
- **`pr_view_spec.js`**: happy path (`URL=`/`IS_DRAFT=`) and — critical — the silent-exit-1 "no PR found" case: assert **both sides** produce empty stdout, empty stderr, and exit code 1, since this is the one subcommand whose native path uses `DispatchFailure` specifically to preserve that silence.
- **`pr_ready_spec.js`**: happy path (`OK\n`) and API-failure error text.
- **`engine_dispatch_spec.js`**: covers `engine.mode=native` and `engine.mode=shell` (and missing/default) routing for all four subcommands through the real `auto-fix-issue/scripts/github.sh` router (scripter's Step 1) — unlike the `auto-fix-all-github` precedent, which only exercised a throwaway wrapper because its real shell shim was left unwired, this repo's actual `github.sh` is being rewritten as part of this issue, so this spec must run against the real file.

Normalize any genuinely non-deterministic output (timestamps, PR numbers assigned by GitHub, etc.) the same way existing parity specs do for their own non-deterministic fields (e.g. `commit_change`'s abbreviated-hash normalization) — confirm during implementation whether these subcommands need equivalent normalization against a live/fixture GitHub API, or whether the whole GitHub-facing layer is mocked at the `fetch`/`gh` boundary for parity purposes instead (check the closest existing precedent for a GitHub-REST-touching parity test before deciding).

## Files to Change

- `core/spec/bin/autoFixIssueGithubParity/info_spec.js` — new.
- `core/spec/bin/autoFixIssueGithubParity/pr_create_spec.js` — new.
- `core/spec/bin/autoFixIssueGithubParity/pr_view_spec.js` — new.
- `core/spec/bin/autoFixIssueGithubParity/pr_ready_spec.js` — new.
- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js` — new.

# node Plan: Migrate resolve_and_fetch.sh to a native (Node.js) implementation

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — this plan produces the native side of the command key `resolve-and-fetch`, matching `scripter`'s simplified `#<id>`-only input grammar and exact `STATUS=`/`ERROR=` output contract byte-for-byte, including the state-file locking protocol and label→tag table.

## Steps

- [01 — Implement the native module](node/01-implement-native-module.md)
- [02 — Wire into core/bin/arcanum](node/02-wire-into-bin-arcanum.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Zero runtime dependencies — Node's built-in global `fetch` (Node 18+) and `child_process` (`execFile`/`spawn` with argument arrays, never string-interpolated `exec()`) only.
- `scripter`'s Step 05 (flipping `migration-status.json`) depends on all of this being committed and passing first — see [plan.md](plan.md)'s "Gating."
- The parity test (Step 04) lives at `core/spec/bin/resolveAndFetchParity_spec.js` — a Jasmine spec (the default location), just not a 1:1 mirror of a single `core/lib/` module, since it exercises `core/bin/arcanum resolve-and-fetch` end to end against `arcanum/_lib/resolve_and_fetch_shell.sh`.
- Coverage gap, documented in the parity spec's own header: it doesn't exercise a real "fresh GitHub fetch success" or a real non-2xx GitHub REST failure, since `github_issue.sh` hardcodes `https://api.github.com` with no override hook and reaching it for real would violate the "no real network calls in specs" rule. Instead it exercises the shared "no local file → attempt to fetch from GitHub → `STATUS=error`" code path via an offline, deterministic origin-resolution failure (the fixture repo's local-filesystem-path `origin` remote isn't GitHub-shaped). The native module's own success-fetch behavior (labels, `DOMAIN`/`REPO`, file write, state write) is covered separately by `GithubIssue_spec.js`'s fixture-mocked `fetch`.
- The parity harness also surfaced that `arcanum/_lib/resolve_and_fetch_shell.sh` resolves its `issues_folder` argument against the caller's ambient cwd (it never `cd`s into `repo_path` itself — only `checkout_safe_branch.sh`'s own child process does). The parity spec accounts for this by running both the shell and native invocations with `cwd` set to the fixture repo, matching how real skill callers invoke it (already parked at `$REPO_PATH`, per [repo-path-threading.md](../../architecture/repo-path-threading.md)) — flagged here for `scripter`/`architect` awareness in case it's worth hardening later, since it's the same bug class #208 already fixed elsewhere.

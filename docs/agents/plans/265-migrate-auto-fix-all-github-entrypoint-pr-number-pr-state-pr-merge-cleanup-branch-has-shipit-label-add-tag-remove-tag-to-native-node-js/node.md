# node Plan: Migrate auto-fix-all-github entrypoint (pr-number, pr-state, pr-merge, cleanup-branch, has-shipit-label, add-tag, remove-tag) to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — ConfigChain.js (3-tier config reader)](node/01-config-chain.md)
- [02 — pr-number, pr-state, cleanup-branch](node/02-read-and-cleanup-commands.md)
- [03 — pr-merge](node/03-pr-merge.md)
- [04 — has-shipit-label, add-tag, remove-tag](node/04-tag-commands.md)
- [05 — Wire into core/bin/arcanum and migration-status.json](node/05-wire-up-registration.md)
- [06 — Unit tests, parity tests, dispatch verification](node/06-tests-and-parity.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `build` — lint step)
- `core`: `yarn duplication` (CI job: `build` — informational, non-blocking)

## Notes

- Follow `docs/agents/architecture/script-engine.md` throughout: zero runtime deps, built-in Node APIs only, global `fetch` + `gh auth token` for GitHub REST calls (never `gh pr view`/`gh pr merge`/`gh issue view`), any `git`/`gh` shell-out via `execFile`/`spawn` with an argument array (never string-interpolated `exec()`), 2-space indent/single quotes/semicolons/`const`+`let`/strict `===`/JSDoc on public methods.
- `GH_INSECURE_SKIP_VERIFY=true` (set by the shell script before shelling to `gh`) is `gh`-CLI-specific — confirmed by precedent in `GithubIssue.js`/`AutoFixAllQueue.js`, neither of which sets or checks any TLS-related env var for their `fetch` calls. No native equivalent needed anywhere in this migration.
- No real network calls in CI: mock/stub `fetch` using fixture data under `core/spec/support/fixtures/`, per the doc's testing conventions.
- This is the largest/most complex script in the `auto-fix-all-github` migration batch (257 lines across 7 subcommands) — budget accordingly, and lean on the step split above rather than doing it as one pass.
- The sibling `auto-fix-all-wait-ci-and-merge` migration (tracked separately, still `false` in `migration-status.json`) depends on this one landing first, since `wait_ci_and_merge.sh` directly invokes `github.sh pr-merge`.

# node Plan: Migrate auto-fix-all-wait-ci entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Shim the shell entrypoint through engine_dispatch](node/01-shim-shell-entrypoint.md)
- [02 — Add the ignored_check_patterns read to RepoConfig](node/02-repoconfig-ignored-check-patterns.md)
- [03 — Implement AutoFixAllWaitCi.js](node/03-implement-autofixallwaitci.md)
- [04 — Register the command and flip migration status](node/04-register-command.md)
- [05 — Native unit tests](node/05-unit-tests.md)
- [06 — Parity test](node/06-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)

## Notes

- Reuse existing collaborators instead of reinventing them: `core/lib/Origin.js` (`resolve()` → `{ domain, repo }`, replacing `get_repo_ref`), `core/lib/GithubToken.js` (`get()`, replacing `_ensure_gh_user`/`gh auth token`), and the `fetch` + `AbortSignal.timeout` + `response.ok` error-handling shape already established in `core/lib/AutoFixAllReplyComment.js`/`GithubIssue.js`.
- For the injectable poll interval, follow the constructor-injection precedent already in the codebase: `core/lib/Lock.js`'s `sleepMs` option and `core/lib/SpawnIssue.js`'s `sleepFn` dependency. No new pattern needed.
- `GH_INSECURE_SKIP_VERIFY=true` (set by the shell script before shelling to `gh`) is a `gh`-CLI-specific TLS setting; the native path calls GitHub's REST API directly via `fetch` and does not need an equivalent — confirm this holds during implementation, but do not carry the env var forward into the native path.
- Shell fallback filename and shim comment style should match the five already-merged siblings exactly (e.g. `auto-fix-all/scripts/reply_comment.sh`/`reply_comment_shell.sh`): thin dispatch shim in the original filename, full original logic moved to a new `_shell.sh` file, `engine_dispatch` call naming this entrypoint's `migration-status.json` key.

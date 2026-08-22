# node Plan: Migrate auto-fix-all-reply-comment entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Implements the command `auto-fix-all-reply-comment`, matching the key the `scripter` agent's shim passes to `engine_dispatch` and the key it flips to `true` in `arcanum/_lib/migration-status.json`.
- Must be byte-identical in stdout and exit code to `auto-fix-all/scripts/reply_comment_shell.sh` for the same inputs — see `plan.md`'s "Shared contracts" for the exact CLI/exit-code contract. In particular: the shell script prints nothing of its own to stdout on success (the `gh pr comment` output isn't captured/echoed) and exits 0; on any failure it exits non-zero with an error on stderr and nothing on stdout.
- Reuse `core/lib/Origin.js` (resolve `domain`/`repo` from the git origin) and `core/lib/GithubToken.js` (resolve a `gh auth token`, including the `gh auth switch --user` best-effort step) rather than re-deriving either — same collaborators `core/lib/GithubIssue.js` already injects for its own REST calls.

## Steps

- [01 — Implement AutoFixAllReplyComment.js and register it](node/01-implement-module.md)
- [02 — Unit tests](node/02-unit-tests.md)
- [03 — Parity test](node/03-parity-test.md)

## CI Checks

- `core`: `yarn test` (CircleCI job `test`) — unit + parity specs, coverage via c8.
- `core`: `yarn lint` (CircleCI job `checks`) — ESLint flat config (2-space indent, single quotes, semicolons, `const`/`let`, strict `===`, no `console.log`, JSDoc on public functions).

## Notes

- No runtime npm dependencies: use the global `fetch` for the GitHub REST call and `child_process.execFile`/`spawn` with argument arrays (never string-interpolated `exec()`) for every shell-out (`gh auth token`, `git push`, the out-of-batch `resolve_pr_number.sh`) — per `docs/agents/architecture/script-engine.md`'s security requirements.
- Never print the GitHub token to stdout or logs.

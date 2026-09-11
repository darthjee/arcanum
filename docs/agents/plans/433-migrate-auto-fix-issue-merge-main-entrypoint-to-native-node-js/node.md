# Node Plan: Migrate auto-fix-issue-merge-main entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Split the shim from the shell implementation](node/01-split-shim.md)
- [02 — Add the native command](node/02-add-native-command.md)
- [03 — Register the command](node/03-register-command.md)
- [04 — Flip the migration-status entry](node/04-flip-migration-status.md)
- [05 — Native unit tests](node/05-unit-tests.md)
- [06 — Parity test](node/06-parity-test.md)

## CI Checks

- `core`: `yarn lint && yarn test` (CI job: `core-test`, see `.github/workflows/`) — covers the new command, its unit tests, and the parity test.

## Notes

- `arcanum/_lib/migration-status.json` already has an `"auto-fix-issue-merge-main": false` entry (added when the #427 batch overview was drafted) — flip it to `true`, don't add a new key.
- No dependency on any other #427 sub-issue: no in-batch script calls `merge_main.sh`, and it calls none of them.
- `git_branch_merge_main` (in `arcanum/_lib/git_branch.sh`) is the shell helper whose behavior the native command re-derives; it stays untouched — per `docs/agents/architecture/script-engine.md`'s scope boundaries, there's no wholesale `_lib` migration, only per-entrypoint native re-derivation.

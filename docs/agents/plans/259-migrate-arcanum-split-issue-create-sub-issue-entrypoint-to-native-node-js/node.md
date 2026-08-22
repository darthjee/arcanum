# node Plan: Migrate arcanum-split-issue-create-sub-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command name `arcanum-split-issue-create-sub-issue` must match the `core/bin/arcanum` `COMMANDS` key, the `arcanum/_lib/migration-status.json` key, and the string scripter's shim passes to `engine_dispatch` — see plan.md.
- Success stdout: `STATUS=ok\nID=<new_id>\n`, exit 0. Failure stdout: `STATUS=failed\n` via a thrown `DispatchFailure`, exit 1 — reuse `core/lib/DispatchFailure.js` exactly as `core/lib/SpawnIssue.js` does.
- Preserve the shell script's `Creating sub-issue <count> for issue #<issue_id>: <title>` progress line verbatim before delegating, so the parity test passes.

## Steps

- [01 — Create the native module](node/01-create-native-module.md)
- [02 — Register the command and flip migration-status.json](node/02-register-command.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `lint`)

## Notes

- Read `arcanum-split-issue/scripts/create_sub_issue.sh` first for its exact current contract (title/body parsing, count-segment derivation, `spawn_issue.sh`/`issue_state.sh` calls, `STATUS=ok`/`STATUS=failed` output) before writing the native module — this plan describes the target shape, not a line-by-line port.
- `core/lib/SpawnIssue.js`'s `run(repoPath, parentId, title, bodyFile, asSubissueFlag)` returns `STATUS=ok\nID=...\nURL=...\n` on success and throws `DispatchFailure('STATUS=failed\n')` when its retry budget is exhausted — the new module only needs `ID` out of that, and must re-throw/propagate the same `DispatchFailure` shape rather than swallowing it.
- `core/lib/IssueState.js`'s `run(repoPath, 'append-json', issueId, 'sub-issues', jsonValue)` (or its `appendJson` method directly) is the native equivalent of `issue_state.sh append-json`.

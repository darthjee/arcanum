# node Plan: Migrate arcanum-split-issue-finish entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Native module: `core/lib/ArcanumSplitIssueFinish.js`, class `ArcanumSplitIssueFinish`, method `run(repoPath, issueId)`, registered in `core/bin/arcanum`'s `COMMANDS` map as `'arcanum-split-issue-finish': { module: 'ArcanumSplitIssueFinish.js', method: 'run' }`.
- Output contract to reproduce byte-for-byte: `Deleted:\n  <path>\n...\n` (or `Deleted: (nothing to clean up)\n`) followed by `BRANCH=<branch>\n`; plain thrown `Error` on failure (no `DispatchFailure`).
- Shells out to `arcanum-split-issue/scripts/github.sh mark-split <repoPath> <issueId>` via `execFile` (array args) for the relabel step; reuses `SafeBranch#checkout` directly (no shell-out) for the branch-release step.
- `scripter` owns flipping `arcanum/_lib/migration-status.json`'s `arcanum-split-issue-finish` key to `true` — do that only after this module and its `COMMANDS` registration land, so the flag is never live before the native implementation exists.

## Steps

- [01 — Create the native module](node/01-create-native-module.md)
- [02 — Register the command](node/02-register-command.md)
- [03 — Native unit tests](node/03-unit-tests.md)
- [04 — Shell/native parity test](node/04-parity-test.md)

## CI Checks

- `core/`: `make core-check` (CircleCI jobs: `test`, `checks`)

## Notes

- `core/lib/SafeBranch.js` and `core/lib/RepoPath.js` are already-migrated dependencies to import and inject, not to reimplement.
- `core/lib/GithubIssue.js` covers `create`/`info` only — `mark-split` has no native counterpart yet (tracked separately as the still-unmigrated `github-issue` entrypoint), so it stays a shell-out for this issue.

# node Plan: Migrate auto-fix-all-cleanup-artifacts entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command name `auto-fix-all-cleanup-artifacts` must match the `arcanum/_lib/migration-status.json` key scripter uses.
- CLI argument order (after `ARCANUM_REPO_PATH`): `<issue_file> <plan_dir> <id> <model_name> <model_email>`.
- Output/exit-code contract: no stdout on success either way (no-op or committed+pushed), exit 0; usage error on stderr, exit 1.
- Commit message is hardcoded — see `plan.md`'s "Shared contracts" for the exact text — not sourced from `arcanum/_lib/commit_template.sh`/`agent_email.sh`.

## Steps

- [01 — Create AutoFixAllCleanupArtifacts.js](node/01-create-native-module.md)
- [02 — Register the command in core/bin/arcanum](node/02-register-command.md)
- [03 — Write native unit tests](node/03-native-unit-tests.md)
- [04 — Write the shell/native parity test](node/04-parity-test.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)

## Notes

- Reference implementations for the `execFile`/dependency-injection pattern: `core/lib/SafeBranch.js` (git subcommands via `execFile` with `cwd: repoPath`) and `core/lib/SpawnIssue.js` (class shape, constructor-injected deps for testing).
- `git commit`/`git push` need the committer's identity resolved from `~/.gitconfig` (via the forwarded `HOME` env var) — the shell implementation sets no `GIT_AUTHOR_*`/`GIT_COMMITTER_*` overrides, so the native one must not add any either.
- Per `docs/agents/architecture/script-engine.md`'s "No standalone, wholesale `_lib` migration" rule, only re-derive the `push_current_branch` logic (`git push -u origin <branch>:<branch>`) natively for this entrypoint's own use — do not attempt a general-purpose port of `arcanum/_lib/push.sh`.

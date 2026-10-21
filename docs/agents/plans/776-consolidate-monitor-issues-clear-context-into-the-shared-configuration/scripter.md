# Scripter Plan: Consolidate monitor-issues clear_context into the shared configuration

Main plan: [plan.md](plan.md)

## Shared contracts

- Namespace `monitor-issues`. `clear_context` → `.claude/state/arcanum-config.json`, with no legacy file (`""`). Any other key → `.claude/configuration/arcanum-repo-config.json`, with legacy `.claude/configuration/monitor-issues.json`.
- The shell scripts keep their cwd-relative `<key> [<value>]` CLI, with no `<repo_path>` argument, and `config.sh` doesn't change.
- `get`/`is-enabled`/`set`/`toggle` semantics come from `repo_config_read`/`repo_config_write`, exactly as in `auto-fix-all/scripts/config_*_shell.sh`: `get` prints `jq -c` output, or `false` when the value is absent. The `node` engine must produce byte-identical stdout/stderr/exit codes; the parity spec checks this.
- Locking goes through `repo_config_write` (`<new file>.lock`). `monitor-issues-config.lock` is dropped.
- `# config-key: monitor-issues.clear_context` goes directly above each `repo_config_read`/`repo_config_write` call.
- Migration `arcanum/migrations/repos/next/001.sh`: `applies_to: "local"`, `skippable: false`, `repo_config_seed .claude/state/arcanum-config.json .claude/state/monitor-issues-config.json monitor-issues`. It never deletes anything.
- `node` writes the migration's contract spec and the registry entry. You only provide the script and its manifest entry.

## Steps

- [01 — Route the shell config scripts through repo_config](scripter/01-route-shell-config-through-repo-config.md)
- [02 — Add the local seed migration](scripter/02-add-local-seed-migration.md)
- [03 — Update the docs](scripter/03-update-docs.md)

## CI Checks

- `core` (shell scripts are exercised by the parity, engine-dispatch and docker specs): `make core-test` (CI job: `test`), and `make core-lint` (CI job: `checks`)
- Run `shellcheck` locally on every touched `.sh` file.

## Notes

- `get`'s output changes from `jq -r` to `jq -c` for non-boolean values. Only booleans are stored in practice, so the visible output (`true`/`false`) stays the same.
- `/toggle-monitor-clear-context` and `monitor-issues/SKILL.md` need no edits, since the CLI doesn't change. Confirm their wording still holds, and leave them untouched if it does.

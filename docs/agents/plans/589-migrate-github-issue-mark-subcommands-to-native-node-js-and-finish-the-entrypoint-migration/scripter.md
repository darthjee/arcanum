# Scripter Plan: Migrate github-issue mark-* subcommands to native Node.js and finish the entrypoint migration

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produce** six `arcanum/_lib/github_issue_mark_<name>_shell.sh` 3-line `exec` wrappers, one per command in the plan.md table. Each one `exec`s `github_issue_shell.sh mark-<name> "$@"`.
- **Produce** six `github_issue.sh` shim branches that call `engine_dispatch "$REPO_PATH" github-issue-mark-<name> "${SCRIPT_DIR}/github_issue_mark_<name>_shell.sh" HOME -- "$@"`. Before dispatching, each branch checks `<id>` and on a miss prints `Usage: $0 mark-<name> <repo_path> <id>` to stderr and exits 1.
- **Produce** six `"github-issue-mark-<name>": true` keys in `arcanum/_lib/migration-status.json`, and remove `"github-issue": false`.
- **Rely on** node registering the same six command names in `core/lib/core/commands.js`.
- `github_issue_shell.sh`'s `cmd_mark_*` functions stay **byte-for-byte unchanged**, since they are the shell side of the parity specs. Only its trailing usage block may change, and it is not required to.

## Steps

- [01 — Add mark-* shell wrappers and shim branches](scripter/01-add-mark-shell-wrappers-and-shim-branches.md)
- [02 — Replace the exec fallthrough with a usage error](scripter/02-replace-exec-fallthrough-with-usage-error.md)
- [03 — Update migration status and regenerate the status doc](scripter/03-update-migration-status.md)
- [04 — Point generate_tags_table.sh at the cmd_mark_* source](scripter/04-fix-generate-tags-table-source.md)

## CI Checks

- `bash -n` / `shellcheck` on every touched `.sh` file.
- `scripts/generate_entrypoint_migration_status.sh` output committed and up to date.
- `scripts/check_tags_table.sh` (CI step "Check docs/agents/tag-mutations.md is up to date") and `scripts/test_generate_tags_table.sh`.
- The node agent's parity and engine-dispatch specs (`cd core && npm test`) exercise these wrappers and the shim.

## Notes

- `discuss-issue`, `enhance-issue`, `auto-new-issue` and `arcanum-split-issue` all reach `mark-*` through their `scripts/github.sh` → `arcanum/_lib/github_issue.sh` wrappers. Their call sites don't change.
- Check that no caller relies on the old `*)` fallthrough to reach a subcommand other than the ten now dispatched (`grep -rn "github.sh \|github_issue.sh " --include=*.md`). If an unknown subcommand is found, report it rather than silently breaking it.

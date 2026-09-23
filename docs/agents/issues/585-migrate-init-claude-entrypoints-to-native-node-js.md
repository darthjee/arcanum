# Issue: Migrate init-claude entrypoints to native Node.js

## Description

Part of the remaining shell → Node.js migration (see `docs/agents/architecture/entrypoint-migration-status.md`). All 6 `init-claude` entrypoints (`init-claude/scripts/*.sh`, about 690 lines of shell including the shared `lib/label_config.sh`) are still `false` in `arcanum/_lib/migration-status.json`.

This is a parent issue, split into:

- #592: `set-ci-ignored-patterns`, `setup-templates` and `stamp-arcanum-version`, the three small, self-contained commands. `stamp-arcanum-version` reuses the install-version resolution in `ArcanumUpdateRunUpdate` (#263).
- #593: `setup-docs-structure`, which creates the `docs/agents/` skeleton and the `AGENTS.md` section.
- #594: the label commands. It ports `lib/label_config.sh` once as a shared native module, splits `write-label-config` into three command names (`-replace`, `-remove`, `-add`), and migrates the interactive `sync-labels`.

The three sub-issues are independent of each other. The only shared file is the regenerated status doc, which may need a trivial rebase.

## Expected Behavior

Every `init-claude` entrypoint routes through `engine_dispatch`, and stdout, stderr and exit codes are identical under `engine.mode=native` and `engine.mode=shell`. Once all three sub-issues merge, `migration-status.json` has one `true` key for each dispatched `init-claude-*` command. `write-label-config` is replaced by its three per-subcommand keys, and no `init-claude` key is left `false`.

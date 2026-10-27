# Update the spec and docs

- `docs/agents/specs/cli-install.md`: Status line — `/arcanum-update` (#871) is done; only the migration (#872) is pending.
- `docs/agents/specs/cli-install/update.md`, `/arcanum-update` section:
  - `install-cli` is a plain subcommand of `run_update.sh` that calls the shared script directly — not a migrated entrypoint (no `engine_dispatch`, no `_shell.sh`, no native command). Add this to the Decisions and to the Names row.
  - A new Zip-updater decision: the copy replaces files with new inodes (unlink before copy), so a script still running from the install, such as `run_update.sh`, is never re-read from the new file at a stale offset. Mention the reproduced failure in one sentence and that the new `updater.sh` (exec'd by the old `bootstrap.sh`) protects the first update into this release.
  - Testing strategy: replace "shell and native spec tests ... for the new `install-cli` subcommand" with the actual names: the parity spec (`core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js`), the unit spec (`ArcanumUpdateRunUpdateApply_spec.js`), and `arcanum-update/scripts/test_run_update_install_cli.sh`; plus the new `test_updater.sh` case.
- `docs/agents/architecture/install-and-release.md`: where it describes the updater's copy step, add the new-inode rule in one sentence. Grep for other places that describe `updater.sh`'s `cp -R` (`grep -rn "cp -R" docs/`) and keep them consistent.

## Files to Change
- `docs/agents/specs/cli-install.md` — Status line.
- `docs/agents/specs/cli-install/update.md` — `install-cli` shape, updater copy decision, Names row, Testing strategy.
- `docs/agents/architecture/install-and-release.md` — updater copy rule.

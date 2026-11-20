# Write the script entry

Fill `001.sh` following `arcanum/migrations/repos/0.14.0/001.sh`'s shape (`set -euo pipefail`,
`SCRIPT_DIR`, `cmd_config` / `cmd_run`, usage on unknown subcommand). `TEMPLATE_SRC` is
`${SCRIPT_DIR}/../../../../init-claude/templates/specs.md`. `cmd_run` implements the two
independent checks exactly as in the shared contract, mirroring
`init-claude/scripts/setup_docs_structure_shell.sh`'s "Specs index" and "Specs directory
placeholder" blocks (`-e` for `specs.md`; `.gitkeep` present → skip; non-directory `specs` →
warning on stderr; `ls -A` non-empty → skip; else create). It always exits 0, so it is idempotent
and a non-directory `specs` never blocks the entry.

Fill `001.md` with a short human-readable summary: what it creates, that existing files are never
overwritten, and that `specs.md` is copied from `init-claude/templates/specs.md`.

## Files to Change
- `arcanum/migrations/repos/next/001.sh` — the migration script.
- `arcanum/migrations/repos/next/001.md` — description.

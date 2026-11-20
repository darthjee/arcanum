# Scripter Plan: Per-repo migration: add docs/agents/specs.md to existing repos

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the ids, the manifest entries, and `001.sh`'s `config`/`run` behavior and output
lines exactly as listed in [plan.md](plan.md#shared-contracts); `node` specs them. Report the real
ids if they differ from `001`/`002`.

## Steps

- [01 — Scaffold both entries](scripter/01-scaffold-entries.md)
- [02 — Write the script entry](scripter/02-script-entry.md)
- [03 — Write the instructions entry](scripter/03-instructions-entry.md)

## CI Checks

- `core`: `make core-check` (lint + Jasmine, includes `core/spec/bin/migrationSpecReferences_spec.js`)

## Notes

- Never write `next/` paths into docs: no doc references these entries (issue scope).
- Do not touch `init-claude/` or `setup_docs_structure_shell.sh`; the script is standalone.

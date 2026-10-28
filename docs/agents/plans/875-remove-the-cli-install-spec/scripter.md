# Scripter Plan: Remove the CLI install spec

Main plan: [plan.md](plan.md)

## Shared contracts

`docs/agents/specs/cli-install.md` and its parts are being deleted (by architect). Cite `docs/agents/architecture/cli-install.md` instead, naming the section ("The shared script", "An already-installed client", "Callers"). See the full table in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Repoint the spec citations in `arcanum/_lib`

Only comment text changes:

- `arcanum/_lib/install_cli.sh` lines 6–7: `Source of truth: docs/agents/specs/cli-install.md and its parts (cli-install/install.md, already-installed.md, update.md).` → `Source of truth: docs/agents/architecture/cli-install.md ("The shared script", "An already-installed client" and "Callers").` Re-wrap the comment block as needed.
- `arcanum/_lib/test_install_cli.sh` lines 3–4: `spec docs/agents/specs/cli-install.md and its parts install.md / already-installed.md / update.md` → `see docs/agents/architecture/cli-install.md`.

Afterwards `grep -n "cli-install" arcanum/_lib/install_cli.sh arcanum/_lib/test_install_cli.sh` must show only `architecture/cli-install.md`, and `bash arcanum/_lib/test_install_cli.sh` still passes.

## Files to Change

- `arcanum/_lib/install_cli.sh` — header comment only.
- `arcanum/_lib/test_install_cli.sh` — header comment only.

## Notes

- Do not touch `arcanum/install/`, `arcanum/update/` or `arcanum/migrations/`; the architect repoints those.

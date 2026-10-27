# Scripter Plan: Add a global migration that installs the arcanum CLI

Main plan: [plan.md](plan.md)

## Shared contracts

You produce everything in [plan.md → Shared contracts](plan.md#shared-contracts): the three files, the `config`/`run` subcommands, path resolution relative to `SCRIPT_DIR`, version resolution, and the `install_cli.sh "$VERSION" --no-confirm 2>&1 || true` call with exit `0`. The `node` agent's spec runs your real `001.sh` from a fake install tree, so do not read anything from the cwd or from env vars other than the ones `install_cli.sh` reads itself.

## Implementation Steps

### Step 1 — The migration

- `next/migrations.json` is `[]` today. Replace it with the single global entry from the contract.
- Write `001.sh` in the style of `arcanum/migrations/repos/2.0.0/003.sh`:
  - Use `#!/usr/bin/env bash` and `set -euo pipefail`.
  - Start with a header comment naming the issue (#872) and the spec (`docs/agents/specs/cli-install/update.md`, "Global migration").
  - Define `cmd_config` and `cmd_run`, and a `case` on `$1`.
  - In `cmd_run`:
    - Resolve the version as the contract says.
    - Under `set -e`, guard each step so a failed `jq` or `git` falls through to the "unresolvable" warning instead of aborting. For example, use `VERSION="$(jq ... 2>/dev/null || true)"`.
    - Then call the shared script.
  - No TTY handling: `--no-confirm` means the shared script never opens `/dev/tty`, and choosing `[R]un` at the migration prompt is the consent.
  - Make it executable, and keep it clean under `shellcheck`.
- Write `001.md`, a short summary in the voice of `2.0.0/003.md`. It says:
  - The migration installs or updates `arcanum-cli` globally, pinned to the installed arcanum version.
  - It runs once per machine or account, and `[S]kip` leaves the client alone.
  - It never downgrades and leaves a linked dev checkout alone.
  - Warnings name the manual `npm i -g arcanum-cli` command, and the migration always succeeds.
  - `ARCANUM_SKIP_CLI=1` also skips it.

### Step 2 — Docs

- `docs/agents/architecture/install-and-release.md`, `### Install`: replace "The CLI is optional. No per-repo migration installs it or nudges the user to." with:
  - The CLI is optional, and the installer and updater offer it.
  - The global migration `arcanum/migrations/repos/next/001.sh` offers it once per machine or account: skippable, pinned to the installed arcanum version, `--no-confirm` (`[R]un` is the consent), warn and continue.
- Switch every `next/001` citation in the CLI-install spec to the full path `arcanum/migrations/repos/next/001.sh`, and drop the "until #872 creates the file" wording:
  - `docs/agents/specs/cli-install.md`: line 80 and the `## Migration` list.
  - `docs/agents/specs/cli-install/update.md`: the "Global migration" heading may keep a short label, but the bullets cite the full path. Rewrite the "Citation" bullet to say the file now exists.
  - `docs/agents/specs/cli-install/already-installed.md`, line ~110.
  - `docs/agents/specs/cli-install/self-update.md`, line ~207.
- Leave `docs/agents/specs/shell-engine-removal.md`'s `next/001` unchanged: it names a different migration that has already shipped (#601).
- `docs/agents/specs/cli-install/update.md`, "Testing strategy": replace "bats tests for version resolution..." with the Jest contract spec `core/spec/bin/migrationsCliInstall_spec.js` and its cases (see [node.md](node.md)).
- `docs/agents/specs/cli-install.md` "Status": every implementation part now exists, including the migration (#872).
- `docs/agents/architecture/per-repo-migrations.md`: only if it keeps a list of existing global migrations, add this one there. Do not add a new list.

## Files to Change

- `arcanum/migrations/repos/next/migrations.json`: the global entry.
- `arcanum/migrations/repos/next/001.sh`: new migration.
- `arcanum/migrations/repos/next/001.md`: new summary.
- `docs/agents/architecture/install-and-release.md`: the rule change.
- `docs/agents/specs/cli-install.md`, `docs/agents/specs/cli-install/update.md`, `docs/agents/specs/cli-install/already-installed.md`, `docs/agents/specs/cli-install/self-update.md`: the full-path citations, the Status line and the Testing strategy.

## CI Checks

- `shellcheck arcanum/migrations/repos/next/001.sh`
- `scripts/test_bump_version.sh`, plus a dry check that `scripts/bump-version.sh`'s guard finds no stale `arcanum/migrations/repos/next/NNN` reference (every cited `001` now has its file).

## Notes

- Ids restart per version folder. If another migration lands in `next/` before this PR merges, take the next free id and update every citation and the spec's literal to match.
- The migration only ever gets run from a real install's copy (`update_per_file.sh` runs it from `$INSTALL_ROOT/arcanum/migrations/...`), so the `../../../..` depth holds before and after `bump-version.sh` renames `next/` to the version folder.

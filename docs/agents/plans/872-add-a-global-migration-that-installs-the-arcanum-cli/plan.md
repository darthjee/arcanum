# Plan: Add a global migration that installs the arcanum CLI

Issue: [872-add-a-global-migration-that-installs-the-arcanum-cli.md](../../issues/872-add-a-global-migration-that-installs-the-arcanum-cli.md)

## Overview

Add the skippable global migration `arcanum/migrations/repos/next/001.sh`. On `[R]un`, it finds the installed arcanum version (from `arcanum.json`, or else from an exact git tag) and runs the shared client step `arcanum/_lib/install_cli.sh <version> --no-confirm`. It always exits `0`. A Jest contract spec covers it. The docs change the "no migration installs it" rule and cite the migration by its full file path. Source of truth: `docs/agents/specs/cli-install.md` and `cli-install/update.md` ("Global migration").

## Agents involved

- [scripter](scripter.md): the migration files and the docs.
- [node](node.md): the contract spec `core/spec/bin/migrationsCliInstall_spec.js`.

## Shared contracts

- **Files.**
  - `arcanum/migrations/repos/next/migrations.json` holds exactly `[{"id": "001", "type": "script", "file": "001.sh", "skippable": true, "applies_to": "global"}]`.
  - `arcanum/migrations/repos/next/001.sh` is executable.
  - `arcanum/migrations/repos/next/001.md` is the summary.
- **Subcommands.**
  - `001.sh config` prints `{"skippable": true}` and exits `0`.
  - `001.sh run` performs the migration.
  - Anything else prints `Usage: ... {config|run}` on stderr and exits `1`.
- **Path resolution.** Paths are relative to the script, never the cwd:
  - `SCRIPT_DIR` is the script's directory.
  - The install root is `INSTALL_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"`.
  - The shared script is `${INSTALL_ROOT}/arcanum/_lib/install_cli.sh`.
  - A test can therefore copy `001.sh` to `<tmp>/arcanum/migrations/repos/next/001.sh` of a fake install, with a stub at `<tmp>/arcanum/_lib/install_cli.sh`.
- **Version resolution in `run`:**
  1. `jq -r '.version // empty' "${INSTALL_ROOT}/arcanum.json"` when that file exists.
  2. Else `git -C "$INSTALL_ROOT" describe --tags --exact-match 2>/dev/null`, used as is, with no `v` stripping. The shared script validates semver itself.
  3. If both are empty, print one warning line to **stdout** naming `npm i -g arcanum-cli`, do not call the shared script, and exit `0`.
- **Call.** `"${INSTALL_ROOT}/arcanum/_lib/install_cli.sh" "$VERSION" --no-confirm 2>&1 || true`, then exit `0`.
  - `2>&1` is required: `update_per_file.sh` captures a migration's stderr and shows it only when the migration fails, and `install_cli.sh` writes every user-facing line to stderr. Without the redirect, an exit-`0` migration would swallow every warning.
  - Any exit code of the shared script still ends in exit `0`.
- **Spec path literal.** The spec names the script as the single literal `'arcanum/migrations/repos/next/001.sh'`, so `scripts/bump-version.sh` rewrites it on release.

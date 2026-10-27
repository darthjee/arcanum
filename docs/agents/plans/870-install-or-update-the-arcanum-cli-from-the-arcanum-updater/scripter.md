# Scripter Plan: Install or update the arcanum CLI from the arcanum updater

Main plan: [plan.md](plan.md)

## Overview

Wire `install_cli.sh "$VERSION"` into the two update paths, following `docs/agents/specs/cli-install/update.md`, then cover both with standalone test scripts and update the spec's Status line and Testing strategy.

## Context

- `arcanum/_lib/install_cli.sh` (#868) prints user-facing lines on stderr. It exits `0` on every outcome, `1` on a usage error, and `4` (with `FALLBACK=chat`, `CLI_VERSION=<v>` and, when a client is installed, `CLI_INSTALLED=<v>` on stdout) only with no TTY and `ARCANUM_CLI_PROMPT=chat`.
- #869 wired it into `arcanum/install/installer.sh`, clearing `ARCANUM_CLI_PROMPT` and using `|| true`. The updater differs: it keeps `ARCANUM_CLI_PROMPT` (which `/arcanum-update` will set in #871) and propagates exit `4`.
- `updater.sh` runs from the unzipped release tree, and its `cleanup` EXIT trap deletes that tree (`WORK_DIR="$RELEASE_ROOT"`) and the lock. So the client step must call the **installed** copy, `$TARGET/arcanum/_lib/install_cli.sh`, which `cp -R` has just put in place.
- `bootstrap.sh`'s git path runs `git checkout <version>`, which rewrites `bootstrap.sh` itself on disk while bash is running it.

## Steps

- [01 — Client step in updater.sh](scripter/01-updater-call.md)
- [02 — Client step in the bootstrap.sh git path](scripter/02-bootstrap-git-call.md)
- [03 — Tests](scripter/03-tests.md)
- [04 — Docs](scripter/04-docs.md)

## CI Checks

- No CI job runs the standalone `test_*.sh` scripts yet (#882). Run them locally:
  - `bash arcanum/update/test_updater.sh`
  - `bash arcanum/update/test_update_bootstrap.sh`
  - `bash arcanum/install/test_installer.sh`
  - `bash arcanum/_lib/test_install_cli.sh`
- Run `bash -n` on every touched script.

## Notes

- Stay bash 3.2 compatible (macOS `/bin/bash`): no `mapfile`, no associative arrays, no `${var,,}`.
- Under `set -e`, capture the status with `"$script" "$VERSION" || cli_status=$?`. A bare call followed by `$?` would abort on a non-zero exit.
- `exit 4` inside `updater.sh` still runs the `cleanup` trap, and the script keeps exit status `4`, because `cleanup` never calls `exit`.
- Out of scope:
  - `run_update_apply`'s flag and the `install-cli` subcommand (#871);
  - the migration (#872);
  - the README and user guide (#873);
  - the architecture docs (#874);
  - CI wiring (#882).

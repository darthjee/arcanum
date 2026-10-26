# Scripter Plan: Add the shared arcanum-cli install script

Main plan: [plan.md](plan.md)

## Overview

Write `arcanum/_lib/install_cli.sh`, a plain bash script (no `engine_dispatch` shim, no `_shell.sh` twin, no `core/` command, no `migration-status.json` entry) that installs or updates `arcanum-cli@<version>` globally following `docs/agents/specs/cli-install.md` and its parts, plus `arcanum/_lib/test_install_cli.sh`, and the small spec and `script-engine.md` updates the issue decided.

## Context

- Spec: `docs/agents/specs/cli-install.md` (Shared rules, Version pinning), `cli-install/install.md` (Flow step 5, Outcomes), `cli-install/already-installed.md` (Detection, Version comparison, Linked, Foreign `arcanum` on `PATH`, Flow, Outcomes, Names), `cli-install/update.md` (exit `4` keys, `--no-confirm`, `ARCANUM_CLI_PROMPT`).
- Order of checks (issue's Expected Behavior, which refines `already-installed.md`'s Flow): skip env → semver validation → TTY check (bypassed by `--no-confirm` or `ARCANUM_CLI_PROMPT=chat`) → node/npm + floor `22.13.0` → `npm ls` detection → `npm view` → prompt / exit `4` → `npm i -g --ignore-scripts "arcanum-cli@<v>"` → `PATH` check.
- TTY convention: follow `arcanum/_lib/next_step_prompt_shell.sh` — `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"` (test-only override), probe with `( exec 3< "$TTY_DEVICE" ) 2>/dev/null`, prompt written to the TTY, answer read from it.
- Test convention: standalone `arcanum/_lib/test_*.sh` scripts like `arcanum/_lib/test_lock.sh` (`set -uo pipefail`, `fail()`, temp dir with `trap cleanup EXIT`, exit 0 on success). No bats. CI does not run these yet (#882).
- `cli/` is not in the release zip (`scripts/build_release_zip.sh` EXCLUDES), so the Node floor is a constant in the script.
- `script-engine.md` says new skills are native-only and `docs/agents/specs/shell-engine-removal.md` plans to delete every `*_shell.sh`. This script is neither a skill entrypoint nor a `_shell.sh` twin; record it as an explicit exception so the removal never touches it.

## Steps

- [01 — Script skeleton and pre-npm checks](scripter/01-skeleton-and-checks.md)
- [02 — Detection and semver wrapper](scripter/02-detection-wrapper.md)
- [03 — Publish check, consent, install and PATH check](scripter/03-install-flow.md)
- [04 — Standalone tests](scripter/04-tests.md)
- [05 — Spec and architecture doc touch-ups](scripter/05-docs.md)

## CI Checks

- No CircleCI job covers `arcanum/_lib/*.sh` or its `test_*.sh` scripts today (#882 adds one). Run locally before opening the PR:
  - `bash arcanum/_lib/test_install_cli.sh`
  - `shellcheck arcanum/_lib/install_cli.sh arcanum/_lib/test_install_cli.sh` (Codacy runs shellcheck on the PR)
  - markdownlint on the changed docs (`.markdownlint.json` at the root).

## Notes

- The script must work under macOS's bash 3.2 (no `mapfile`, no associative arrays, no `${var,,}`) and without GNU `timeout`: bound `npm ls` with `spawnSync(..., {timeout})` inside the `node -e` wrapper, and `npm view` with `--fetch-retries=0 --fetch-timeout=<ms>`.
- Never `sudo`, never `--force`, never a retry, and `arcanum-cli@<v>` always passed as one quoted argument.
- Every user-facing line goes to stderr with the `arcanum-cli:` prefix; stdout carries only the exit-`4` keys.

# Scripter Plan: Install the arcanum CLI from the arcanum installer

Main plan: [plan.md](plan.md)

## Overview

`installer.sh` gains one guarded call to `install_cli.sh` after `arcanum installed to <target>`, plus the `ARCANUM_TTY_DEVICE` seam for its own prompts. A new standalone `arcanum/install/test_installer.sh` covers the integration (ordering, exit-code isolation, env handling). Docs: the `bootstrap.sh` env-var header and the CLI-install spec.

## Context

- Spec: `docs/agents/specs/cli-install.md` and `cli-install/install.md` (Flow step 5, Outcomes, Testing strategy).
- `arcanum/_lib/install_cli.sh <version> [--no-confirm]`: exits `0` on every outcome, `1` on usage error, `4` only with no TTY and `ARCANUM_CLI_PROMPT=chat`. All output on stderr; stdout only on exit `4`. It honors `ARCANUM_TTY_DEVICE` (test-only) and `ARCANUM_CLI_TIMEOUT_MS` (test-only).
- `arcanum/_lib/test_install_cli.sh` is the reference harness: `env -i` runs, stub `npm` logging calls to a file, stub `node` faking `--version` and exec'ing the real `node`, `run`/`assert_*` helpers.

## Steps

- [01 — Wire the client step into installer.sh](scripter/01-installer-call.md)
- [02 — Add test_installer.sh](scripter/02-tests.md)
- [03 — Docs touch-ups](scripter/03-docs.md)

## CI Checks

- No CI job runs standalone `test_*.sh` yet (#882). Run locally: `bash arcanum/install/test_installer.sh` and `bash arcanum/_lib/test_install_cli.sh`.
- shellcheck on the touched scripts (Codacy runs it on the PR): `shellcheck arcanum/install/installer.sh arcanum/install/test_installer.sh`.
- markdownlint on the touched docs: `npx markdownlint-cli2 docs/agents/specs/cli-install.md docs/agents/specs/cli-install/install.md`.

## Notes

- Bash 3.2 (macOS) compatible: no associative arrays, no `${var,,}`; no GNU `timeout`.
- A regular file used as `ARCANUM_TTY_DEVICE` is reopened by every `read ... < "$TTY_DEVICE"`, so **every read sees its first line**. Tests must be designed around that (see step 02).
- The release zip ships `arcanum/_lib/` and `arcanum/install/`, so the `SCRIPT_DIR`-relative path to `install_cli.sh` is valid in a real install.

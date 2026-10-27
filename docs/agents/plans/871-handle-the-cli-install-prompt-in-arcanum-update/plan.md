# Plan: Handle the CLI install prompt in /arcanum-update

Issue: [871-handle-the-cli-install-prompt-in-arcanum-update.md](../../issues/871-handle-the-cli-install-prompt-in-arcanum-update.md)

## Overview

`/arcanum-update` opts in to the client step's chat fallback (`ARCANUM_CLI_PROMPT=chat`). `run_update_apply` (shell and native) passes exit `4` through after its `RESULT=` line, the skill asks the install question with `AskUserQuestion` and resumes with a new plain-bash `run_update.sh install-cli <version>` subcommand. `updater.sh` stops overwriting files in place, so scripts that are still running (`run_update.sh`, `run_update_apply_shell.sh`) are not corrupted by the update that replaces them.

## Agents involved

- [scripter](scripter.md): `updater.sh` copy, `run_update_apply_shell.sh`, `run_update.sh install-cli`, test scripts, spec docs.
- [node](node.md): `ArcanumUpdateRunUpdate.apply`, its unit spec, the shell/native parity spec and its bootstrap stub.
- [skill-writer](skill-writer.md): `arcanum-update/SKILL.md` exit-`4` branch.

## Shared contracts

- **Env var.** `run_update_apply` runs `bootstrap.sh` with `ARCANUM_ASSUME_YES=1` **and** `ARCANUM_CLI_PROMPT=chat`, in both engines.
- **`run_update.sh apply` on exit `4`.** stdout, in order: the lines streamed by `bootstrap.sh` (from the client step: `FALLBACK=chat`, `CLI_VERSION=<v>`, and `CLI_INSTALLED=<v>` only when a client is installed), then `RESULT=updated FROM=<old> TO=<new>` (or `RESULT=noop VERSION=<v>` if the version somehow did not change; computed the same way as on exit `0`). Exit code `4`. Native: `throw new DispatchFailure('<RESULT line>\n', 4)`. Shell: print the line and `exit 4`. Exit `0` and every other non-zero code behave exactly as today (other non-zero: no extra stdout, same code).
- **`run_update.sh install-cli <version>`.** Plain case branch in `run_update.sh`, not a migrated entrypoint (no `engine_dispatch`, no `_shell.sh`, no native command, no `migration-status.json` entry). Runs `"${TARGET_PATH}/arcanum/_lib/install_cli.sh" "<version>" --no-confirm` and exits with its code (`0` for every outcome, `1` usage). Exactly one argument after `install-cli`, otherwise usage on stderr and exit `1`. Output is `install_cli.sh`'s own (stderr lines prefixed `arcanum-cli:`).
- **Skill reads**: the `CLI_VERSION=` and `CLI_INSTALLED=` values from the streamed stdout of `apply`, and the final `RESULT=` line, exactly as above.

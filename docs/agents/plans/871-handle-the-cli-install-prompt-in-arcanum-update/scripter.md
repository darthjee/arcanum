# Scripter Plan: Handle the CLI install prompt in /arcanum-update

Main plan: [plan.md](plan.md)

## Shared contracts

- `run_update_apply_shell.sh` exports `ARCANUM_ASSUME_YES=1` and `ARCANUM_CLI_PROMPT=chat` before running `bootstrap.sh`.
- On `bootstrap.sh` exit `4`: compute `AFTER`, print the same `RESULT=` line as on exit `0`, then `exit 4`. Any other non-zero: unchanged (no stdout, same code). The native side (`node`) must produce byte-identical stdout and the same code — the parity spec in `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` (owned by `node`) checks it.
- `run_update.sh install-cli <version>`: a plain case branch running `"${TARGET_PATH}/arcanum/_lib/install_cli.sh" "$2" --no-confirm`, exiting with its code; wrong argument count → usage on stderr, exit `1`. Not a migrated entrypoint.
- The skill (`skill-writer`) relies on the above stdout keys and exit codes.

## Steps

- [01 — Replace files instead of overwriting them in updater.sh](scripter/01-updater-new-inodes.md)
- [02 — Opt in and pass exit 4 through in run_update_apply_shell.sh](scripter/02-apply-shell-exit-4.md)
- [03 — Add the install-cli subcommand](scripter/03-install-cli-subcommand.md)
- [04 — Update the spec and docs](scripter/04-docs.md)

## CI Checks

- Shell test scripts are not wired into CI yet (#882); run them locally: `bash arcanum/update/test_updater.sh`, `bash arcanum/update/test_update_bootstrap.sh`, `bash arcanum-update/scripts/test_run_update_install_cli.sh` — each prints `ok`.
- `shellcheck` every touched `.sh` file if it is available locally.
- The parity spec (`make core-test`, CI job running `yarn test` in `core/`) exercises `run_update_apply_shell.sh`; coordinate with `node`.

## Notes

- Keep bash 3.2 compatible (macOS `/bin/bash`): no `mapfile`, no `${var,,}`, guard empty arrays under `set -u`.
- Under `set -e`, capture codes with `cmd || rc=$?`.
- Step 01 must ship in the same release as step 03: the old local `bootstrap.sh` execs the **new** `updater.sh`, so the new copy logic is what protects the crossing update from the old, still-running `run_update.sh`.

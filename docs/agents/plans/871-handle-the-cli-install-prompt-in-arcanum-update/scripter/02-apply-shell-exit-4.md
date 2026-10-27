# Opt in and pass exit 4 through in run_update_apply_shell.sh

In `arcanum-update/scripts/run_update_apply_shell.sh`:

- `export ARCANUM_CLI_PROMPT=chat` next to `export ARCANUM_ASSUME_YES=1`.
- After `"$BOOTSTRAP" || RC=$?`: if `RC` is `4`, fall through to the `AFTER`/`RESULT=` computation and then `exit 4`; any other non-zero keeps `exit "$RC"` with no output. E.g. keep the existing `RESULT=` printing in one place and end with `exit "$RC"` when `RC` is `4`, `exit 0` otherwise.
- Update the header comment: the flag, and that exit `4` (client step wants the chat question; the arcanum update is complete) still prints the `RESULT=` line, after the `FALLBACK=chat` / `CLI_VERSION=` / `CLI_INSTALLED=` lines that `bootstrap.sh` already streamed.

Also update the `apply` description in the `arcanum-update/scripts/run_update.sh` header comment the same way.

The shell/native parity spec (owned by `node`) adds the exit-`4` case; run `make core-test` (or `yarn test` in `core/`) once both sides are in to confirm parity.

## Files to Change
- `arcanum-update/scripts/run_update_apply_shell.sh` — export `ARCANUM_CLI_PROMPT=chat`; exit `4` prints `RESULT=` and exits `4`; header comment.
- `arcanum-update/scripts/run_update.sh` — header comment for `apply`.

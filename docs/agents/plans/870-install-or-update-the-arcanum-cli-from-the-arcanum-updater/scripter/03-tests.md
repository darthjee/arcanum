# Tests

Add two standalone scripts in the style of `arcanum/install/test_installer.sh`:

- `set -uo pipefail`, a `fail` helper and a temp dir removed by an EXIT trap;
- `SKIP` and exit `0` when a required tool (`jq`, `git`) is missing;
- exit `0` on success.

Both use the same **stub `install_cli.sh`**, written by the test:

- It appends one record line to `$STUB_LOG`, with:
  - `$0`, so the test can assert the caller ran the installed or checked-out copy;
  - `$*`;
  - `ARCANUM_CLI_PROMPT=${ARCANUM_CLI_PROMPT-<unset>}`;
  - a state probe given by the test through `$STUB_PROBE`, a shell snippet that is eval'd, for example to print `arcanum.json`'s version or `git -C "$TARGET" describe --tags`.
- It exits `${STUB_RC:-0}`. When that is `4`, it first prints `FALLBACK=chat` and `CLI_VERSION=$1` on stdout.

The stub replaces the real `install_cli.sh`, whose outcomes are covered by `arcanum/_lib/test_install_cli.sh`.

## `arcanum/update/test_updater.sh`

Per case, build a **fresh** fake release tree, because `updater.sh`'s cleanup deletes its own release root. The tree holds:

- the repo's real `arcanum/update/updater.sh`;
- the stub at `arcanum/_lib/install_cli.sh`;
- a `MANIFEST` listing both.

Also build a fake `TARGET` with an `arcanum.json` at an older version. Run `bash <release>/arcanum/update/updater.sh` with `TARGET`, `REPO` and `VERSION` exported, so there is no `/dev/tty` read. Capture stdout and stderr separately. Cases:

1. **Order and path.**
   - Exit `0`, and exactly one stub call.
   - `$0` is `$TARGET/arcanum/_lib/install_cli.sh`, and the argument is `$VERSION`.
   - The probe saw `arcanum.json` at the new version.
   - stderr has `arcanum updated to` before the stub's record, so have the stub also echo a marker on stderr.
2. **Already on the version.** `arcanum.json` is already at `$VERSION`: exit `0`, `Already on`, and no stub call.
3. **Exit 4 propagated.** With `STUB_RC=4`:
   - The updater exits `4`, and stdout is exactly the stub's `FALLBACK=chat` / `CLI_VERSION=` lines.
   - The release tree and `$TARGET/.arcanum-update.lock` are gone.
   - `arcanum.json` is at the new version.
4. **Other failure ignored.** With `STUB_RC=1`, the updater exits `0`.
5. **Prompt flag passed through.** With `ARCANUM_CLI_PROMPT=chat` exported, the stub records `ARCANUM_CLI_PROMPT=chat`.

## `arcanum/update/test_update_bootstrap.sh` (git path)

Set up a local "origin" repo with `git init` and a local `user.name`/`user.email`. It holds the repo's real `arcanum/update/bootstrap.sh`, plus:

- tag `1.0.0`: no `arcanum/_lib/install_cli.sh`;
- tag `2.0.0`: the stub at `arcanum/_lib/install_cli.sh`;
- tag `3.0.0`: the stub too.

Use a `git clone` of it as `TARGET`. Run `bash "$TARGET/arcanum/update/bootstrap.sh"` with:

- `ARCANUM_ASSUME_YES=1`, so there is no `/dev/tty` read;
- `ARCANUM_VERSION=<tag>`, so there is no `curl`;
- `ARCANUM_REPO=x/y`.

Make a fresh clone per case. Every tagged tree must contain the real `bootstrap.sh`, so it still exists after the checkout. Cases:

1. **Called from the checked-out tree.**
   - The clone starts on `1.0.0` and updates to `2.0.0`, with exit `0` and one stub call.
   - `$0` is under `$TARGET`, and the argument is `2.0.0`.
   - The probe (`git -C "$TARGET" describe --tags --exact-match`) prints `2.0.0`.
2. **Old tag without the script.** From `2.0.0` to `1.0.0`: exit `0`, no stub call, and stderr ends with the `arcanum updated to` line, with nothing about arcanum-cli.
3. **Already on the version.** From `2.0.0` to `2.0.0`: exit `0`, `Already on`, and no stub call.
4. **Exit 4 propagated.** From `2.0.0` to `3.0.0` with `STUB_RC=4`: exit `4`, and the `FALLBACK=chat` / `CLI_VERSION=3.0.0` lines are on stdout.
5. **Other failure ignored.** From `2.0.0` to `3.0.0` with `STUB_RC=1`: exit `0`.

Commit the real `bootstrap.sh` and the stub on the start commit too, so the clone's initial checkout runs the code under test.

## Files to Change

- `arcanum/update/test_updater.sh` (new): zip-path tests.
- `arcanum/update/test_update_bootstrap.sh` (new): git-path tests.

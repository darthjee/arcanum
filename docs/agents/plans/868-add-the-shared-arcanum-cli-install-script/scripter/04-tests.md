# Standalone tests

Create `arcanum/_lib/test_install_cli.sh`, in the style of `arcanum/_lib/test_lock.sh` (header with usage, `set -uo pipefail`, `fail()`, a temp dir removed by `trap cleanup EXIT`, exit `0` on success).

Harness:

- A temp `bin/` placed first on `PATH` with stub `npm` and `node`.
  - Stub `npm` logs each call (`$*`) to a file and answers from env-configured canned output and exit codes per subcommand (`ls`, `view`, `i`, `prefix`); it can sleep to exercise the timeout.
  - Stub `node` answers `--version` from an env value and `exec`s the real `node` (resolved before `PATH` is changed) for everything else, so the `node -e` wrapper really runs. Skip the wrapper-dependent cases with a clear message if no real `node` is available.
- TTY: `ARCANUM_TTY_DEVICE` pointed at a nonexistent path for "no TTY", or at a regular file holding the answer for prompt cases (the prompt text then lands in that same file; assert on it).
- The timeout seam set to a few hundred milliseconds.
- A helper that runs the script and captures stdout, stderr and the exit code separately.

Cases (assert exit code, the stderr line, stdout, and the recorded `npm` calls):

- Every row of `install.md`'s Outcomes: installed, skipped by env, invalid version, no TTY, declined, no Node or npm, Node too old, unpublished (`E404` and empty output), `EACCES`, network error.
- Every row of `already-installed.md`'s Outcomes and Edge cases: updated, unchanged, newer kept, linked (`link: true` and `resolved: "file:…"`), unknown (no output, invalid JSON, entry without `version`, `missing: true`, timeout), declined update, update failed (`EEXIST`), `invalid`-flagged entry with a readable version.
- No `npm` call at all for `ARCANUM_SKIP_CLI`, invalid version and no TTY; no `npm view`/`npm i` for same, newer, linked, unknown.
- `ARCANUM_ASSUME_YES=1` does not answer the prompt.
- `--no-confirm` with no TTY installs; `--no-confirm` with a newer client does not downgrade.
- `ARCANUM_CLI_PROMPT=chat` with no TTY: exit `4` with `FALLBACK=chat`, `CLI_VERSION=<v>`, and `CLI_INSTALLED=<old>` only for an older client; same/newer/linked/unknown exit `0` with nothing on stdout.
- `npm i -g` is called with `--ignore-scripts` and `arcanum-cli@<v>` as one argument.
- Usage errors exit `1`.
- `PATH` check: a fake `arcanum` earlier on `PATH` than the stub prefix's `bin`, and a prefix `bin` not on `PATH`; symlinked `PATH` entry pointing at the prefix `bin` raises no warning.
- Semver comparison, table-driven through the wrapper (via canned `npm ls` output): `2.2.3 < 2.3.0`, `2.3.0-rc.1 < 2.3.0`, `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0`, `10.0.0 > 9.9.9`, build metadata ignored.
- Node-floor drift: read `engines.node` from `cli/package.json` (repo-relative to the test script, using the real `node`) and fail unless it is `>=` followed by the script's `CLI_NODE_FLOOR`. Skip with a message when `cli/package.json` is absent (an installed tree has no `cli/`).

## Files to Change

- `arcanum/_lib/test_install_cli.sh` — new standalone test script.

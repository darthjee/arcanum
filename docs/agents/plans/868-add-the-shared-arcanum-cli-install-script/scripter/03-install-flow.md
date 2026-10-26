# Publish check, consent, install and PATH check

Finish the flow in `arcanum/_lib/install_cli.sh`:

1. **`npm view`.** `npm view "arcanum-cli@<v>" version --fetch-retries=0 --fetch-timeout=<ms>` (15000 by default; the same test seam as step 02). Capture stdout and stderr.
   - Exit `0` with non-empty output → published, continue.
   - Exit `0` with empty output, or stderr matching `E404` → warning `arcanum-cli@<v> is not published on npm`, manual command `npm i -g arcanum-cli`, exit `0`.
   - Any other failure → warning naming a network error (include the `npm` error code when one is found), exit `0`.
2. **Consent.**
   - `--no-confirm` → proceed without asking.
   - TTY available → write the prompt to the TTY and read the answer from it: `Install arcanum-cli@<v> globally (npm i -g)? [Y/n] ` for `missing`, `Update arcanum-cli <old> → <new> (npm i -g)? [Y/n] ` for `older`. Empty, `y` or `yes` (case-insensitive) → yes; `n` or `no` → info `skipped by user`, with the manual command, exit `0`; anything else re-asks; TTY closed before an answer → treat as no.
   - No TTY and `ARCANUM_CLI_PROMPT=chat` → print `FALLBACK=chat`, `CLI_VERSION=<v>` and, for `older`, `CLI_INSTALLED=<old>` on stdout, in that order, and exit `4`.
3. **Install.** `npm i -g --ignore-scripts "arcanum-cli@<v>"`, with npm's stdout/stderr passed through to stderr. On failure, classify by the captured output: `EACCES` → warning with a hint to fix the npm global prefix (no `sudo` retry); `EEXIST` → warning that another package owns the `arcanum` binary; otherwise → warning with the reason. All exit `0`. On success: info `arcanum-cli@<v> installed.` (`missing`) or `arcanum-cli updated <old> → <v>.` (`older`).
4. **`PATH` check** (after installed, updated, `same` and `newer`): `prefix_bin="$(npm prefix -g)/bin"`; resolve both it and `dirname "$(command -v arcanum)"` with `cd -P … && pwd -P`. Different → warning `arcanum on PATH is <path>, not the client at <prefix_bin>/arcanum; reorder PATH or remove the other one.`; `arcanum` not on `PATH` → warning `the client is at <prefix_bin>/arcanum, but <prefix_bin> is not on PATH.` Never run the foreign binary. These lines do not add the manual-install suffix.
5. Exit `0`.

## Files to Change

- `arcanum/_lib/install_cli.sh` — `npm view`, consent (TTY prompt, `--no-confirm`, exit `4`), `npm i -g`, failure classification and the `PATH` check.

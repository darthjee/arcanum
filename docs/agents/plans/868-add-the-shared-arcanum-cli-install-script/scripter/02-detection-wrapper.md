# Detection and semver wrapper

Add the `node -e` wrapper inside `install_cli.sh` (a heredoc or a single-quoted string passed to `node -e`, with the target version and timeout passed as `process.argv` entries, never interpolated into the JS source).

The wrapper:

1. Runs `npm ls -g --json --depth=0 arcanum-cli` with `child_process.spawnSync('npm', [...], { encoding: 'utf8', timeout })`. `timeout` defaults to 15000 ms; the test-only seam (e.g. `ARCANUM_CLI_NPM_TIMEOUT_MS`) overrides it. Ignore the exit code.
2. Classifies `stdout`:
   - timeout, spawn error, empty output or invalid JSON → `unknown`;
   - valid JSON with no `dependencies["arcanum-cli"]` → `missing`;
   - entry with `link: true` or a `resolved` starting with `file:` → `linked` (print the link target, `resolved` minus `file:`, as `CLI_LINK=<path>` for the info line);
   - entry without `version`, or `missing: true` → `unknown`;
   - otherwise compare the installed version with the target → `older`, `same` or `newer`; an installed version that is not plain semver → `unknown`. `invalid`/`extraneous` flags are ignored when a readable `version` exists.
3. Prints `CLI_STATE=<state>`, plus `CLI_INSTALLED=<v>` when the version is known, and for `unknown` a `CLI_REASON=<short reason>` used in the warning.

Semver precedence (about 15 lines, no dependency), per `already-installed.md`'s Version comparison: drop `+build`; compare `MAJOR.MINOR.PATCH` numerically; on a tie a prerelease is lower than none; prerelease identifiers compared pairwise — both numeric → numerically, numeric before alphanumeric, otherwise ASCII order; a shorter identifier list is lower when all shared ones are equal.

Back in bash, read the `KEY=value` lines and `case` on `CLI_STATE`:

- `same` → info `arcanum-cli@<v> is already up to date.`, exit `0`;
- `newer` → info `arcanum-cli@<installed> is newer than <target>; left as is. Downgrade with: npm i -g --ignore-scripts arcanum-cli@<target>`, then the `PATH` check (step 03), exit `0`;
- `linked` → info `arcanum-cli is linked from <path>; left as is.`, exit `0`;
- `unknown` → warning with the reason, exit `0`;
- `older`, `missing` → continue.

`same` also runs the `PATH` check, since the client is present.

## Files to Change

- `arcanum/_lib/install_cli.sh` — the `node -e` detection/comparison wrapper and the `CLI_STATE` dispatch.

# The self-update command

New `cli/lib/commands/selfUpdate.js`, registered as `'self-update'` in `COMMANDS` in `cli/lib/main.js`, following the spec's [Flow](../../../specs/cli-install/self-update.md#flow):

1. `--help` → the command usage (see below), exit `0`.
2. Platform: on `win32` (`deps.platform`), `CliError` exit `1`: `self-update is not supported on Windows`, hint `npm i -g arcanum-cli@latest`. No npm call.
3. Arity and flags: any positional → `UsageError("self-update: unexpected argument 'x'")`; `context.targeting.repo` or `context.targeting.claudeConfigDir` set → `UsageError('--repo is not accepted by self-update')` / `'--claude-config-dir is not accepted by self-update'`.
4. Running package: walk up from `import.meta.url` to the nearest `package.json` named `arcanum-cli` (`deps.packageDir` overrides it in specs), then `realpath` it.
5. `npm root -g` (~15 s timeout). Global copy at `<root>/arcanum-cli`: if it is a symlink (`lstat`) → `TargetUnavailableError` (linked checkout); if missing or its `realpath` differs from the running package → `TargetUnavailableError` (not the global install, hint adds `npm i -g arcanum-cli@latest` / the project's package manager and the nvm note). Timeout or failure → `NpmError` `could not locate the npm global install (npm root -g failed)`.
6. `npm view arcanum-cli@latest version --json --fetch-retries=0 --fetch-timeout=15000` (~30 s process timeout). Map `network`/`timeout` → `could not reach the npm registry`; `not_found` → `arcanum-cli is not on the configured registry (<registry>)`, with `<registry>` from a best-effort `npm config get registry` (~5 s timeout, fallback `the configured registry`).
7. Parse the JSON string and validate it as `MAJOR.MINOR.PATCH[-prerelease]`; otherwise `NpmError` `npm returned an invalid version '<x>'`, no install.
8. Compare with `context.version` via `compareVersions`: equal → `up_to_date`; running newer → `newer`; both exit `0` with no install.
9. Progress note on stderr: `arcanum: note: updating arcanum-cli <from> → <to>...`.
10. `npm i -g --ignore-scripts arcanum-cli@<v>` (package as one argument, no timeout). `permission` → `the npm global prefix (<prefix>) is not writable` with the spec's hint, `<prefix>` = two `dirname`s of the `npm root -g` result; other failures → `npm i -g failed (exit <n>)`; `SIGINT` → `InterruptedError` with `the install may be incomplete; run arcanum self-update again` and the `npm i -g arcanum-cli@latest` fallback.
11. Verify: read `<root>/arcanum-cli/package.json`; a version other than `<v>` → `NpmError` `npm i -g reported success but arcanum-cli is at <x>`.
12. Result on stdout: the human lines from the spec's Outcomes table, or under `--json` exactly one `{"status","from","to","latest"}` object. On success, npm's captured output is dropped, or written to stderr under `ARCANUM_DEBUG=1`.

`ARCANUM_SKIP_CLI` is ignored. Never `sudo`, never a shell, never `--registry`.

Help (`cli/lib/help.js`): a top-level Commands row `self-update   Update this CLI to the latest release`, and `arcanum self-update --help` with `Usage: arcanum self-update [--json]`, one paragraph on what it does and refuses, and the options `--json` and `-h, --help`.

Specs inject `deps.runNpm` (or `execFileAsync`), `realpath`, `lstat`, `readFile`, `platform`, `packageDir`; one spec per row of the spec's Outcomes, Failures and Edge cases tables, asserting stdout, stderr, the `--json` object and the exit code; exact npm argv; `npm i -g` never called on a refusal, a usage error, Windows, or an invalid version.

## Files to Change
- `cli/lib/commands/selfUpdate.js` — new: the command.
- `cli/lib/main.js` — register `'self-update'` in `COMMANDS`.
- `cli/lib/help.js` — the Commands row and the command's usage.
- `cli/spec/lib/commands/selfUpdate_spec.js` — new: the flow specs.
- `cli/spec/lib/help_spec.js` — the row and usage.
- `cli/spec/lib/main_spec.js` — dispatch to `self-update`, the arity and targeting-flag usage errors.

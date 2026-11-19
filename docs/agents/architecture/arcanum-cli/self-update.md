# Self-update

Part of [Arcanum CLI](../arcanum-cli.md). This page defines `arcanum self-update` and its npm/verification contract.

## Command behavior

`arcanum self-update [--json]` updates the global `arcanum-cli` package to exact `latest`. It never runs a blind `npm i -g arcanum-cli@latest`.

1. Help and target/arity checks run before npm.
2. The running package is resolved relative to `import.meta.url` and realpath is checked against the global package root.
3. `npm view arcanum-cli@latest version --json --fetch-retries=0 --fetch-timeout=15000` resolves latest, with timeout.
4. The result is validated as plain semver and compared with the embedded running version.
5. npm installs exact `arcanum-cli@<v>` with `--ignore-scripts` and no process timeout.
6. The global package.json is re-read and must report the exact installed version.

## Running copy rules

| Case | Outcome |
|---|---|
| Running global package | Proceed |
| Linked dev checkout/npm link | Refuse; update checkout with git pull and rebuild |
| npx/project-local/source/run copy | Refuse; do not replace another install |
| npm global root fails/times out | Npm error `8` |

Both invalid-copy refusals exit `4` with target-unavailable JSON. Up-to-date/newer outcomes exit `0` and make no network call after global-copy checks.

## Consent and shared rules

There is no confirmation, `--yes`, TTY handling or fallback chat. Invoking the command is consent. The target is exact and constrained to the already-global package.

`--ignore-scripts` prevents install-time package code. A successful update will execute that package when it is next run. npm is invoked with `execFile` and an argument array, never a shell. There is no sudo.

## Outcomes

| Outcome | Human | JSON | Exit |
|---|---|---|---|
| Updated | `Updated arcanum-cli <from> → <to>` | status updated | `0` |
| Up to date | `arcanum-cli is up to date (<v>)` | status up_to_date | `0` |
| Newer | Newer-than-latest message | status newer | `0` |
| Linked/not-global | Refusal/hint | target_unavailable error | `4` |
| npm/verification failure | Error/hints plus npm stderr | npm error | `8` |

Stdout stays result-only. Progress goes stderr; JSON stdout is exactly one object.

## Failures

npm failures include missing npm, global-root lookup failure, registry network/E404/other failure, invalid semver, unwritable npm prefix, install failure and post-install version mismatch.

Timeouts: global root `15s`, view `30s` process backstop, install no timeout. npm EACCES/EPERM maps to permissions; E404 names the configured registry; unknown codes remain npm exit `8`.

## Edge cases and security

- Bundle replacement mid-run is safe because the loaded bundle is not lazily re-imported.
- npm running under a different Node than the CLI is detected by real paths.
- Symlinked bins use realpath and proceed normally.
- Concurrent updates are not locked and may fail with npm errors.
- Ctrl-C exits `130/interrupted` and warns that the install may be incomplete.
- Windows is out of scope for POSIX Arcanum; win32 fails before npm calls.
- Cost: up-to-date check uses one global-root call and one bounded npm-view call.

## Backward compatibility

This is an additive command. It adds npm and interrupted exit classes but renumbers no existing code and changes no config shape. It ignores `ARCANUM_SKIP_CLI` because explicit update is not a side effect.

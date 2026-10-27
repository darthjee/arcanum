# Node Plan: Handle the CLI install prompt in /arcanum-update

Main plan: [plan.md](plan.md)

## Shared contracts

- `ArcanumUpdateRunUpdate.apply` spawns `bootstrap.sh` with `env: { ...process.env, ARCANUM_ASSUME_YES: '1', ARCANUM_CLI_PROMPT: 'chat' }`.
- Exit `4` from `bootstrap.sh`: compute `after` and the `RESULT=` line exactly as on exit `0`, then `throw new DispatchFailure(<that line>, 4)` — `core/bin/arcanum` writes it to stdout and exits `4`. Other non-zero: unchanged (`DispatchFailure('', code)`).
- Must match `run_update_apply_shell.sh` (owned by `scripter`) byte for byte; the parity spec checks it.
- `install-cli` is shell-only (a plain branch in `run_update.sh`); there is **no** native command or `commands.js` entry for it.

## Implementation Steps

### Step 1 — Native apply: opt in and pass exit 4 through

In `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js`:

- `_runBootstrap`: add `ARCANUM_CLI_PROMPT: 'chat'` to the spawn env; update its JSDoc.
- `apply`: treat `code === 4` like `0` for the `after`/`RESULT=` computation, then throw `new DispatchFailure(result, 4)`; any other non-zero keeps `throw new DispatchFailure('', code)`. Extract the `RESULT=` line building into a small helper if it keeps `apply` readable. Update the JSDoc (`@returns` / `@throws`) and the class comment if it lists outcomes.
- `core/lib/commands/arcanum-update/README.md`: mention the flag and the exit-`4` outcome.

Unit spec `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js`:

- the existing env assertion also checks `options.env.ARCANUM_CLI_PROMPT === 'chat'`;
- new: exit `4` with a version change rejects with a `DispatchFailure` whose `stdout` is `RESULT=updated FROM=<old> TO=<new>\n` and `exitCode` is `4`;
- the existing generic non-zero case stays (empty stdout, same code).

### Step 2 — Parity: exit-4 case

- `core/spec/support/fixtures/arcanum_update_bootstrap_stub.sh`: add a marker, e.g. `<root>/.fixture-cli-fallback`. When present (and no `.fixture-fail`), after the version bump the stub prints `FALLBACK=chat`, `CLI_VERSION=<new version>` and `CLI_PROMPT=${ARCANUM_CLI_PROMPT-<unset>}` (records the flag the stub saw), then exits `4`. Document it in the header comment. Also make the plain success path print the `ARCANUM_CLI_PROMPT` it saw only if that does not change existing expected outputs — otherwise keep it to the new marker.
- `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js`: a new `itMatchesParity` case using that marker with `.fixture-new-version` `1.1.0`, expecting code `4` and stdout `bootstrap: starting\nFALLBACK=chat\nCLI_VERSION=1.1.0\nCLI_PROMPT=chat\nRESULT=updated FROM=1.0.0 TO=1.1.0\n` (adjust to the stub's actual line order). This also proves both engines set the flag.

## Files to Change
- `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` — flag in the spawn env; exit `4` → `DispatchFailure(RESULT, 4)`; JSDoc.
- `core/lib/commands/arcanum-update/README.md` — flag and exit `4`.
- `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdateApply_spec.js` — env and exit-`4` assertions.
- `core/spec/support/fixtures/arcanum_update_bootstrap_stub.sh` — `.fixture-cli-fallback` marker.
- `core/spec/bin/arcanumUpdateRunUpdateParity/apply_spec.js` — exit-`4` parity case.

## CI Checks
- `core/`: `make core-check` (lint + test; CI runs `yarn lint` and `yarn test` in `core/`).

## Notes
- The parity case needs the `scripter` change to `run_update_apply_shell.sh` (step 02) to pass; both land in the same PR.

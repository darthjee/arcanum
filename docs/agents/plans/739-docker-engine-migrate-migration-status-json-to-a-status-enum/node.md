# Node Plan: Docker engine: migrate migration-status.json to a status enum

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on scripter's `_engine_dispatch_status <command> <native_only>` (prints one of `shell|native|docker|host-only`, always exit 0) and on `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE` being a sourced variable that you override after `source arcanum/_lib/engine_dispatch.sh`. Dispatch behavior under `shell`/`native` is unchanged from today; see [plan.md](plan.md#shared-contracts) for the full table.

## Implementation Steps

### Step 1 — Create core/spec/bin/engineDispatchDocker_spec.js

Create the spec described in `docs/agents/specs/docker/testing.md` (lines ~34–40), covering only the non-docker parts for now. Add a small helper in the spec, or under `core/spec/support/utils/` if it fits, that runs `bash -c 'source "$1"; _ENGINE_DISPATCH_MIGRATION_STATUS_FILE="$2"; shift 2; "$@"' _ <engine_dispatch.sh> <fixture map> <fn> <args...>` through `runCommand`. The fixture map is written to a temp dir per test (`createTempDir`/`removeTempDir`).

- **Reading rule** (call `_engine_dispatch_status` directly), for `<native_only>` = `false` and `true`:
  - each of `"shell"`, `"native"`, `"docker"`, `"host-only"` (native-only: `"shell"` → `native`);
  - legacy `true` / `false`;
  - missing key, unknown string value (e.g. `"bogus"`), non-string non-boolean value (e.g. `1`);
  - missing map file, malformed JSON file.
  Assert stdout (trimmed) and exit code 0.
- **Other modes** (call `engine_dispatch` through the same wrapper, with `seedEngineMode` on a temp repo): fixture command `auto-fix-all-config-get` (shell twin `auto-fix-all/scripts/config_get_shell.sh`, seeded config as in `test_engine_dispatch.sh`). For `engine.mode` `shell` and `native`, against each of the 4 status values, assert which implementation ran per the spec's mode table:
  - `shell` mode → shell always;
  - `native` mode → `shell` status: shell plus the exact existing warning on stderr; `native`/`docker`/`host-only`: native, with no warning.
  Distinguish shell from native by the stderr warning and a native-only observable (e.g. `dispatch-fixture-crash` crashing only when native runs), whichever is cleanest. Use `dispatch-fixture-crash` where it helps.
- Leave a short comment that the docker cases are added by the later #729 sub-issues.

### Step 2 — Lint and test

Run `make core-check` (or `yarn lint && yarn test` in `core/`) and fix any lint/JSDoc findings, following the conventions in sibling specs such as `arcanumCheckConfig_spec.js`.

## Files to Change

- `core/spec/bin/engineDispatchDocker_spec.js` — new spec (reading rule plus shell/native mode table).
- `core/spec/support/utils/*` — only if a reusable `bash -c` source wrapper is worth extracting.

## CI Checks

- `core/`: `make core-check` (CI jobs: `yarn test`, `yarn lint`).

## Notes

- Do not touch `core/spec/bin/arcanumCheckConfig_spec.js`'s docker hard-error case. It changes in a later sub-issue.

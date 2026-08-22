# node Plan: Migrate permission-grant entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" for `PermissionGrant.js#run(action, file, pattern)`'s full behavior contract, the `permission-grant` command name, and the `Lock.js` reuse requirement. This agent produces the native module and its registry wiring; `migration-status.json`'s flag flip (which depends on this work existing and passing tests) belongs to [scripter](scripter.md).

## Implementation Steps

### Step 1 — Implement `PermissionGrant.js` and wire it into the router

Add `core/lib/PermissionGrant.js` implementing `run(action, file, pattern)` per the shared contract: action validation (usage message + exit 1 for anything other than `add`), parent-directory creation with silent degrade-on-failure (warning to stderr, exit 0), lock-protected (`core/lib/Lock.js`) read-merge-write of `<file>`'s `.permissions.allow` array (treat missing/invalid JSON as `{}`, dedupe via a `Set`/equivalent, preserve every other top-level key), atomic write (`.tmp` file + rename). Zero runtime npm dependencies — only built-in `node:fs`/`node:path` APIs, matching every other `core/lib/` module so far.

Register it in `core/bin/arcanum`'s `COMMANDS` table: `'permission-grant': { module: 'PermissionGrant.js', method: 'run' }`, following the existing one-line-per-command convention (see `checkout-safe-branch`, `list-agents`).

### Step 2 — Add test coverage

Add `core/spec/lib/PermissionGrant_spec.js` (unit tests): file doesn't exist yet, file exists with unrelated top-level content (untouched), pattern already present (dedup — no duplicate entry), parent-directory creation failure (silent degrade, exit 0, warning text), unrecognized/missing action (usage message, exit 1), concurrent-write lock contention (reuse `Lock_spec.js`'s existing patterns for exercising `Lock.js`, e.g. injectable `sleepMs`).

Add `core/spec/bin/permissionGrantParity_spec.js` (shell-vs-native parity, following `checkoutSafeBranchParity_spec.js`/`listAgentsParity_spec.js`'s shape): runs `arcanum/_lib/permission_grant_shell.sh add <file> <pattern>` and `core/bin/arcanum permission-grant add <file> <pattern>` against identical fixture inputs (including the unrecognized-action usage case), asserting identical resulting JSON file content, stdout/stderr, and exit code.

## Files to Change

- `core/lib/PermissionGrant.js` — new native implementation.
- `core/bin/arcanum` — register the `permission-grant` command.
- `core/spec/lib/PermissionGrant_spec.js` — new unit tests.
- `core/spec/bin/permissionGrantParity_spec.js` — new shell-vs-native parity test.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `lint`)

## Notes

- The shell dispatcher's usage message is `Usage: $0 add <file> <pattern>`, where `$0` is whatever path the script was invoked as — not reproducible verbatim from a different process (`core/bin/arcanum`). Match the fixed portion (`add <file> <pattern>`) and pick a stable literal for the leading part; confirm the exact expected string against what the parity spec asserts, adjusting either side (native message text, or the shell shim's own pre-check in `permission_grant.sh` — see [scripter](scripter.md)) to converge, rather than guessing blind.
- `permission_grant_add`'s parent-directory creation in the shell version only creates `<file>`'s own parent (`mkdir -p "$(dirname "$file")"`), not the lock file's parent — `Lock.js#acquire` already creates the lock file's own parent directory itself, so no extra handling is needed there.

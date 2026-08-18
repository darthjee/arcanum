# scripter Plan: Implement the shell/native/docker dispatch guard and migration-status map

Main plan: [plan.md](plan.md)

## Shared contracts

- Owns the migration-status map: `arcanum/_lib/migration-status.json`, flat JSON `{"<command>": true|false}` keyed by command name. Set `dispatch-fixture: true` once node's native fixture module lands (see node's plan).
- Owns the shell-side fixture script for the `dispatch-fixture` command and its expected stdout/exit code — node's native fixture must match these exactly.
- Invokes native via plain argv: `core/bin/arcanum <command> <args...>`, after setting an explicit per-command env-var allowlist (no full ambient env passthrough).

## Implementation Steps

### Step 1 — Add the migration-status map and its query helper

Create `arcanum/_lib/migration-status.json`, initially `{}` (or with `dispatch-fixture` seeded once Step 3 needs it — either order works since this is plain data). Add a small helper function (in `engine_dispatch.sh` itself, or a tiny sourced helper if it's reused elsewhere later — no reuse case exists yet, so keep it inline unless that gets awkward) that reads the map via `jq` and answers whether a given command name maps to `true`. Treat a missing key the same as `false` (native not available).

### Step 2 — Create the throwaway shell-side fixture

Add a small fixture script (e.g. `arcanum/_lib/test_fixtures/dispatch_fixture.sh` — pick the exact path/location, there's no existing fixture-script convention in `arcanum/_lib` to match) that prints a fixed, deterministic line to stdout and exits 0. This stands in for "the existing shell implementation" of a migrated entrypoint. Keep it trivial — its only job is being something `engine_dispatch.sh` can dispatch to and something node's native fixture can byte-match.

### Step 3 — Implement `arcanum/_lib/engine_dispatch.sh`

Following the existing `config_chain.sh`/`repo_config.sh` sharing pattern in `arcanum/_lib`, implement a function (e.g. `engine_dispatch <repo_path> <command> -- <args...>`, or whatever calling shape reads cleanly as a sourced helper — the exact signature is an implementation detail, but it must take the repo path, the command name, and the command's own args) that:

1. Resolves `engine.mode` via `config_chain_read <repo_path> engine mode` (default `shell` when absent at every tier).
2. If `engine.mode=shell`: runs the shell fixture directly, regardless of map state.
3. If `engine.mode=native` or `engine.mode=docker`:
   - Consults `migration-status.json` for the command name.
   - Not available → print a warning to stderr, fall back to running the shell fixture (silent to stdout, not a hard error).
   - Available → invoke `core/bin/arcanum <command> <args...>` with an explicit env-var allowlist. If that invocation exits non-zero (a crash in the native side, not "not implemented"), propagate the failure loudly — no fallback to shell.
   - `engine.mode=docker` is treated identically to the "not available" branch for now (always falls back to shell with a warning), regardless of what the map says — the actual Docker execution path is out of scope for this issue.

### Step 4 — Write `arcanum/_lib/test_engine_dispatch.sh`

Follow the existing standalone test-script convention (see `arcanum/_lib/test_origin_resolution.sh`: a plain bash script, not wired into any skill flow, sourcing the helper under test, run manually, exit 0 on success / non-zero with a stderr message on failure). Cover:

- `engine.mode=shell` → dispatch-fixture command runs the shell path, regardless of what the map says for `dispatch-fixture`.
- `engine.mode=native`, map says `dispatch-fixture: true` → dispatch-fixture command runs the native path (`core/bin/arcanum dispatch-fixture`); assert its stdout/exit code byte-match the shell fixture's (the parity assertion — this is where the shared contract with node gets exercised).
- `engine.mode=native`, map says `dispatch-fixture: false` (or key absent) → falls back to shell, with a warning printed to stderr.
- Native crash case: point the dispatcher at a command name whose "native" invocation is rigged to exit non-zero (a second tiny fixture, or a stubbed `core/bin/arcanum` call — pick whichever keeps the test simplest) → dispatcher fails loud, no fallback output from the shell fixture.
- Use `config_chain`'s existing test/override mechanism (however `config_chain_read`'s own tests stub the 3-tier chain, if such a pattern already exists) or a temp repo-config file to drive each `engine.mode` value deterministically.

## Files to Change

- `arcanum/_lib/engine_dispatch.sh` — new; the dispatch guard.
- `arcanum/_lib/migration-status.json` — new; the migration-status map.
- `arcanum/_lib/test_engine_dispatch.sh` — new; standalone test script.
- `arcanum/_lib/test_fixtures/dispatch_fixture.sh` (path TBD) — new; throwaway shell-side fixture.
- `docs/agents/architecture/shared-state-and-configuration.md` — already documents `engine.mode`; only touch if this work uncovers a gap (e.g. the migration-status map's own path/format is worth a line there for discoverability).

## Notes

- No CI job currently runs any `arcanum/_lib/*.sh` test script (the only CI workflow, `core-ci.yml`, is scoped to `core/**` paths) — `test_engine_dispatch.sh` is run manually, same as `test_origin_resolution.sh` today. Not this issue's job to add shell CI.
- Coordinate the fixture's exact stdout string with node before finalizing Step 2/4 — it must be identical to what node's fixture module in `core/lib/` prints.

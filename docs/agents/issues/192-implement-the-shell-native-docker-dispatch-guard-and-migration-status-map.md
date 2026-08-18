# Issue: Implement the shell/native/docker dispatch guard and migration-status map

## Description
Every migrated entrypoint needs a shared, tested mechanism to decide whether to run its shell, native, or (later) Docker implementation, based on config. This dispatch guard and its migration-status map is the foundational piece every future per-script migration depends on — it must be built and tested once, standalone, against a throwaway fixture, before any real entrypoint moves to native.

## Problem
Per #168's decisions, refined and finalized in #189's `docs/agents/architecture/script-engine.md`:

- Dispatch logic lives in a single shared helper, `arcanum/_lib/engine_dispatch.sh`, parameterized by the command/script name being invoked — not duplicated per entrypoint shim. Follows the existing `config_chain.sh`/`repo_config.sh` sharing pattern already used elsewhere in `arcanum/_lib`.
- Config: the key is `engine.mode` (its own top-level namespace, not nested under a skill), values `shell` (default when absent) / `native` / `docker`, resolved via `config_chain_read <repo_path> engine mode` through the existing 3-tier chain (local state → repo config → global config). Already documented in `docs/agents/architecture/shared-state-and-configuration.md` — repo-wide only for now, no per-script override.
- Migration-status map: `arcanum/_lib/migration-status.json`, a flat JSON object keyed by entrypoint command name (the same name passed to `core/bin/arcanum <command>`) → `true`/`false` (native implementation exists yet). Plain JSON keeps it readable from both bash (`jq`) and the native side. `engine_dispatch.sh` consults it directly — never a try/invoke-and-catch — to answer "does a native implementation exist for this entrypoint yet". It is only ever read, never invoked.
- Every native call must go through the single centralized entrypoint `core/bin/arcanum <command> <args...>` (from #190) — no migrated entrypoint is ever called as a direct `node core/lib/<script>.js` from outside it. `core/bin/arcanum` is currently just a stub (`arcanum: no commands implemented yet`); its own comment states real command routing to `core/lib/` modules lands in this issue.
- Per #168's Backward-compatibility decision, this shim/config addition needs no per-repo migration script — its absence in a repo's config simply defaults to `shell`, today's existing behavior.
- Depended on the `core/` package scaffolding (#190) and its CI/Codacy wiring (#191) — both already merged, so this issue is now unblocked.

## Expected Behavior
- `engine.mode=native` (or `docker`) configured, but the migration-status map says no native implementation exists yet for this entrypoint → silently fall back to `shell`, with a warning printed (not a hard error). This lets the repo-wide setting be flipped to `native` early without breaking not-yet-migrated scripts.
- `engine.mode=native` (or `docker`) configured, a native implementation exists, but it crashes/throws at runtime (a real bug, not "not implemented yet") → the dispatcher fails loud, no automatic fallback to shell. Silently falling back here would mask real regressions.
- `engine.mode=docker` → for this issue, treated the same as an unavailable-native fallback (falls back to `shell` with a warning) regardless of map state — the actual Docker execution path (running `core/bin/arcanum` inside the Docker test image) is explicitly deferred to a later issue.
- `engine.mode=shell` → always runs shell, regardless of map state.

## Solution
- [ ] Add `engine.mode` resolution (via `config_chain_read`) to `arcanum/_lib/engine_dispatch.sh`.
- [ ] Create `arcanum/_lib/migration-status.json` (flat `{"<command>": true|false}` map) plus a small helper to query it by entrypoint command name.
- [ ] Implement `arcanum/_lib/engine_dispatch.sh`'s dispatch logic: resolve `engine.mode`, consult the map, dispatch to shell or to `core/bin/arcanum <command> <args...>`, applying the fallback/fail-loud rules above (`docker` treated as not-yet-implemented for now).
- [ ] Implement `core/bin/arcanum`'s real command routing to the matching `core/lib/` module by command name (replacing the current #190 stub) — generic routing only, not wiring any specific real entrypoint.
- [ ] Add tests for the dispatcher's branching logic: available native + `engine.mode=native` → runs native; unavailable native + `engine.mode=native` → falls back to shell with a warning; native crash → fails loud, no fallback; `engine.mode=shell` → always runs shell regardless of map state.
- [ ] Prove the guard against a throwaway fixture command/script committed as a permanent fixture (e.g. under `core/spec/support/fixtures/`), not any real entrypoint — wiring a real entrypoint into the dispatcher is the next sub-issue's job.

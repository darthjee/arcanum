# node Plan: Implement the shell/native/docker dispatch guard and migration-status map

Main plan: [plan.md](plan.md)

## Shared contracts

- `core/bin/arcanum <command> <args...>` is invoked by scripter's `engine_dispatch.sh` as a plain argv call, with only an explicit per-command environment-variable allowlist set (never the full ambient environment) — do not rely on any other env var being present.
- For the `dispatch-fixture` command, this module's stdout and exit code must byte-match scripter's shell-side fixture exactly (the parity contract scripter's `test_engine_dispatch.sh` asserts). Coordinate the exact string with scripter before finalizing.
- scripter owns setting `dispatch-fixture: true` in `arcanum/_lib/migration-status.json` once this module exists — no action needed on the node side for the map itself.

## Implementation Steps

### Step 1 — Implement real command routing in `core/bin/arcanum`

Replace the current stub (`arcanum: no commands implemented yet`) with routing logic: take the first CLI argument as the command name, look up and dispatch to the matching module under `core/lib/`, pass the remaining arguments through. Keep the routing mechanism itself generic (e.g. a small command→module registry/convention) — this issue does not wire any real migrated entrypoint's command, only the `dispatch-fixture` proof command below. An unknown command name should fail clearly (non-zero exit, message to stderr) rather than silently doing nothing.

### Step 2 — Add the `dispatch-fixture` native module

Add a small module under `core/lib/` (e.g. `core/lib/DispatchFixture.js`, following the existing class-per-file / JSDoc conventions `Greeter.js` already establishes) whose command output matches scripter's shell fixture byte-for-byte on success. Also support (or provide a second command/flag) a rigged-to-throw path, so scripter's "native crash → fails loud" test case has something real to invoke through `core/bin/arcanum` — coordinate the exact command name/args shape with scripter's Step 4.

### Step 3 — Add specs

Add `core/spec/lib/DispatchFixture_spec.js` (and a routing spec for `core/bin/arcanum` itself, e.g. under `core/spec/bin/` or wherever routing tests fit best given the current `core/spec/` layout) covering: known command routes correctly, unknown command fails clearly, and the crash-path command exits non-zero. Follow existing spec conventions (Jasmine, `core/spec/` mirrors `core/lib/` 1:1, `<Name>_spec.js` naming).

### Step 4 — Commit the throwaway fixture as permanent scaffolding

Per the issue's resolved scope, the `dispatch-fixture` module/spec are kept (not deleted before merge) as reusable fixtures for future dispatcher-related tests — same treatment as the existing `core/spec/support/fixtures/` folder already scaffolded in #190. `Greeter.js` stays out of scope here (already slated for removal in #193).

## Files to Change

- `core/bin/arcanum` — replace the #190 stub with real command routing.
- `core/lib/DispatchFixture.js` (naming TBD, coordinate with scripter) — new; native fixture module.
- `core/spec/lib/DispatchFixture_spec.js` — new; unit spec.
- A routing spec for `core/bin/arcanum`'s command dispatch — new; exact path TBD based on current `core/spec/` layout.

## CI Checks

- `core/`: `make core-test` (CI job: `coverage`, workflow `core-ci.yml`)
- `core/`: `make core-lint` (CI job: `checks`, workflow `core-ci.yml`)

## Notes

- No real entrypoint is wired into `core/bin/arcanum`'s routing in this issue — only the `dispatch-fixture` proof command. Wiring a real entrypoint is the next sub-issue's job (per the issue's explicit scope note).
- `core/bin/arcanum` has no runtime npm dependencies available (per `docs/agents/architecture/script-engine.md`) — routing logic must use built-in Node APIs only.

# Issue: Investigate removing dispatch-fixture / dispatch-fixture-crash

## Description
Split off from #339 (organize `core/lib/commands/` into subfolders), which proposed removing the `dispatch-fixture` command as a side quest. Exploration showed it isn't dead code:

`DispatchFixture.js` backs two commands:

- `dispatch-fixture` — `log: false`, used as **the reference command proving shell↔native dispatch parity**: `arcanum/_lib/test_engine_dispatch.sh` byte-matches its native output against the shell-side twin `arcanum/_lib/test_fixtures/dispatch_fixture.sh`, and it's exercised directly in `core/spec/bin/arcanum_spec.js`, `core/spec/lib/core/dispatcher_spec.js` (the `context: 'none'` path test), and `core/spec/lib/core/commands_spec.js` (the `log: false` assertion).
- `dispatch-fixture-crash` — deliberately kept *logged* (per an explicit comment in `core/lib/core/commands.js` citing plan #244/issue #192) to prove `InvocationLog#record` survives a crashing command. Also exercised in `arcanum_spec.js` and `dispatcher_spec.js`.

Both are still listed "Yes, migrated" in `docs/agents/architecture/entrypoint-migration-status.md` (issue #192).

Further exploration during enhancement of this issue found that `context: 'none'` is **not** fixture-only scaffolding: six real, already-migrated commands use it today (`arcanum-update-run-update-check`, `arcanum-update-run-update-apply`, and the four `auto-fix-all-config-*` commands), and those already have a real-command shell/native parity-test precedent — `core/spec/bin/autoFixAllConfigParity_spec.js` runs each native command against its own shell twin (e.g. `auto-fix-all/scripts/config_get_shell.sh`) and asserts byte-identical stdout/exit code, the same shape `test_engine_dispatch.sh` currently proves using `dispatch-fixture`.

`log: false`, by contrast, is real documented `Dispatcher` behavior but is currently exercised by nothing except `dispatch-fixture` — no real command needs it today.

The crash-survival proof (`dispatch-fixture-crash`) is different in kind: its entire job is to crash *deliberately and on demand* (see the comment in `core/lib/core/commands.js` citing #244/#192). No real command offers a designed "crash on demand" contract; forcing one to crash via bad input would mean relying on accidental/undesigned error behavior, which is brittle test coverage (a future hardening fix could silently break the crash-survival test for unrelated reasons).

## Solution
Given the above, this issue is scoped down to the part with a clear existing precedent:

- Rewire `test_engine_dispatch.sh`'s shell/native parity cases (currently exercising `dispatch-fixture`) onto one of the existing real `context: 'none'` commands, following the `autoFixAllConfigParity_spec.js` pattern.
- Remove the `dispatch-fixture` command entry, `DispatchFixture.js`'s `run()` method, and anything used *only* by the success-path fixture (e.g. `arcanum/_lib/test_fixtures/dispatch_fixture.sh`, once nothing else still depends on it) once the above rewiring lands.
- `dispatch-fixture-crash` and `DispatchFixture.js`'s `crash()` method are explicitly **out of scope** here and stay as-is — see the crash-survival follow-up issue below.
- The future of the `log: false` feature itself (keep as an untested-in-practice option, drop it, or find another anchor) is also **out of scope** here — see the `log: false` follow-up issue below.

### Edge cases / backward compatibility

Beyond the four spec files already named, `dispatch-fixture` is also referenced in:

- `arcanum/_lib/migration-status.json` — its `"dispatch-fixture": true` entry should be removed (`"dispatch-fixture-crash": true` stays, since that command is out of scope here).
- `docs/agents/architecture/entrypoint-migration-status.md` — auto-generated from the above via `scripts/generate_entrypoint_migration_status.sh`; its `dispatch-fixture` row disappears automatically once the generator is re-run, no manual edit needed.
- `core/lib/core/commands.js`'s own `CommandEntry` typedef doc comment, which currently lists `dispatch-fixture` alongside `dispatch-fixture-crash`/`auto-fix-all-config-*`/`arcanum-update-run-update-*` as a `context: 'none'` example — needs `dispatch-fixture` dropped from that list.
- `arcanum/_lib/test_engine_dispatch.sh`'s own header comment, which currently describes both commands as "implemented by the node agent working in parallel on this same issue" (#192) — needs updating once only `dispatch-fixture-crash` remains relevant there.
- `DispatchFixture.js`'s class-level doc comment ("Kept as reusable scaffolding... not deleted once #192 lands") — needs updating once its `run()` method is gone and only `crash()` remains.

No CI workflow or `Makefile` target references `dispatch-fixture` directly, so no pipeline-level changes are expected.

### Follow-up issues spun off from this investigation

- #342 — Crash-survival proof: whether `InvocationLog#record` crash-survival can ever be re-anchored on something other than a deliberately-crashing fixture command.
- #343 — `log: false`: what to do with the dispatcher's `log: false` feature now that `dispatch-fixture` (its only user) is going away.

## Benefits
- Removes a purpose-built test fixture in favor of anchoring the shell/native parity proof on real, production-migrated commands, reducing dispatcher-registry surface that exists only for testing.
- Keeps the crash-survival and `log: false` questions explicitly separate and trackable (#342, #343) rather than blocking this narrower, already-precedented cleanup.

# Node Plan: Migrate auto-fix-all-wait-ci-and-merge entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registers `'auto-fix-all-wait-ci-and-merge': { module: 'AutoFixAllWaitCiAndMerge.js', method: 'run' }` in `core/bin/arcanum`'s `COMMANDS` map — the same key `scripter`'s shim passes to `engine_dispatch`, and the same key flipped to `true` in `arcanum/_lib/migration-status.json`.
- `run(repoPath, modelEmail)` must produce the exact `passed\n<url>\n` / `failed\n<name>\n...` output described in `plan.md`'s Shared contracts, since `scripter`'s shim falls back to the shell implementation whenever native isn't available/enabled — the two must stay interchangeable.

## Steps

- [01 — Create the native orchestrator module](node/01-create-orchestrator-module.md)
- [02 — Register the command](node/02-register-command.md)
- [03 — Write native unit tests](node/03-write-unit-tests.md)
- [04 — Write the shell/native parity test](node/04-write-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Blocked-on dependencies (`auto-fix-all-wait-ci` #262, `auto-fix-all-github` #265) are both already merged — `AutoFixAllWaitCi` and `AutoFixAllGithub` exist and are ready to be composed directly, in-process (no shelling out).
- Zero runtime deps, built-in Node APIs only, per `docs/agents/architecture/script-engine.md`.

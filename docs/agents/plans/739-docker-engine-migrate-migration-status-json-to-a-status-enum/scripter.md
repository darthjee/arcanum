# Scripter Plan: Docker engine: migrate migration-status.json to a status enum

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the map format, `_engine_dispatch_status <command> <native_only>` and the generated doc's `| Command | Status | Issue |` shape, exactly as specified in [plan.md](plan.md#shared-contracts). node's spec calls `_engine_dispatch_status` directly through a `bash -c` wrapper that sources `engine_dispatch.sh` and overrides `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE`. Keep that variable's name and its sourced-variable nature. The existing stderr warning text must not change.

## Steps

- [01 — Rewrite migration-status.json as a string enum](scripter/01-rewrite-map.md)
- [02 — Add _engine_dispatch_status and switch dispatch to it](scripter/02-engine-dispatch-status.md)
- [03 — Update the smoke script and native-only shim comments](scripter/03-smoke-script-and-shim-comments.md)
- [04 — Update the generator and regenerate the status doc](scripter/04-generator-and-regenerate.md)

## CI Checks

- `core/`: `make core-check` (CI jobs: tests and lint). It exercises every shim via the parity and routing specs, so a broken dispatch shows up there.
- `bash arcanum/_lib/test_engine_dispatch.sh` (standalone, not run by CI; run it locally).
- `shellcheck` on every touched `.sh` file.

## Notes

- Keep bash 3.2 compatibility in `engine_dispatch.sh` (no `declare -A`, no `${var,,}`, guarded empty-array expansions).
- Commit step 01 on its own, before step 04 regenerates the doc.

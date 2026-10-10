# Scripter Plan: Docker engine: migrate local commands without credentials (batch 1)

Main plan: [plan.md](plan.md)

## Shared contracts

- The 29 keys listed in [plan.md](plan.md#shared-contracts) become `"docker"` in `arcanum/_lib/migration-status.json`, and nothing else changes there.
- Shim `engine_dispatch` calls keep their current arguments: no `--needs`, no `--path-arg`. The node agent's parity specs copy them verbatim, so they must not drift.

## Steps

- [01 — Flip the status map](scripter/01-flip-status-map.md)
- [02 — Update shim headers and the smoke script](scripter/02-update-shim-headers.md)
- [03 — Tick the checklist rows](scripter/03-tick-checklist-rows.md)

## CI Checks

- `arcanum/`, skill `scripts/`: shellcheck (CircleCI lint job), `make core-test` for the routing specs that read the real status map.
- `docs/`: markdownlint (`.markdownlint.json`).

## Notes

- Mirror the pilot commit `3f31ff2` (`arcanum-check-config/scripts/check_config.sh` header) for the wording of the docker paragraph.
- `--native-only` with status `"docker"` already runs in the container under `engine.mode=docker` (pilot), so `set_next_step_auto.sh` keeps its `--native-only` call unchanged.

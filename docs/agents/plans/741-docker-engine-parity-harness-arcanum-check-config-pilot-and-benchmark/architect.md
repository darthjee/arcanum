# Architect Plan: Docker engine: parity harness, arcanum-check-config pilot and benchmark

Main plan: [plan.md](plan.md)

## Shared contracts

- The checklist `issue` cell for `arcanum-check-config` is `#741`.
- Targets: `make docker-parity` and `make docker-benchmark`. The benchmark script is `scripts/docker_benchmark.sh`.

## Implementation Steps

### Step 1 — Tick the pilot's checklist row

In `docs/agents/specs/docker/checklist.md`, set the `arcanum-check-config` row's status to ✅ and its `issue` cell to `#741`. Keep `global-config:ro` in the mounts column and `—` in the env column, since `--needs=global-config` supplies `CLAUDE_CONFIG_DIR`. If the checklist has summary counts or a progress line, update it.

### Step 2 — Docs: status and new tooling

- `docs/agents/specs/docker.md`: rewrite the "Status" section. It still says no docker execution path exists. It should say:
  - the docker branch of `engine_dispatch.sh` is implemented (#740);
  - `arcanum-check-config` is the first docker-ready command (#741);
  - parity runs locally with `make docker-parity`, and per-call cost is measured with `make docker-benchmark`;
  - the macOS/Linux benchmark numbers are recorded in #741's PR. A `docker exec` follow-up is only opened if the threshold in `docker/dispatch.md` is exceeded.
- `docs/agents/specs/docker/testing.md` and `docs/agents/specs/docker/dispatch.md`: reword "#729 adds…" and "#729 measures…" to point at the delivered pieces (#741, `scripts/docker_benchmark.sh`, `make docker-benchmark`). Don't change the design text.
- `docs/agents/folder-structure.md`: add `docker_benchmark.sh` to the `scripts/` row, and `docker-parity`/`docker-benchmark` to the `Makefile` row.

## Files to Change

- `docs/agents/specs/docker/checklist.md`: the pilot row.
- `docs/agents/specs/docker.md`: the Status section.
- `docs/agents/specs/docker/testing.md`, `docs/agents/specs/docker/dispatch.md`: point at the delivered pieces.
- `docs/agents/folder-structure.md`: the `scripts/` and `Makefile` rows.

## Notes

- The maintainer pastes the manual evidence (`make docker-parity` and benchmark output on macOS) into the PR. The auto pipeline doesn't produce it, so the PR description should leave a clearly marked placeholder for it.

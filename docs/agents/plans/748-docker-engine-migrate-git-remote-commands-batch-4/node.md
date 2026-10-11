# Node Plan: Docker engine: migrate git remote commands (batch 4)

Main plan: [plan.md](plan.md)

## Shared contracts

You can rely on each batch-4 shim declaring exactly the `--needs` value in [plan.md](plan.md#shared-contracts) (plus the `--path-arg` list the scripter reports). The `docker` routing cases pass only once the 10 statuses are `"docker"` in `arcanum/_lib/migration-status.json`.

## Steps

- [01 — Add docker routing callbacks for the batch-4 shims](node/01-routing-callbacks.md)
- [02 — Add docker parity cases for the batch-4 commands](node/02-parity-cases.md)

## CI Checks

- `core/`: `make core-test` and `make core-lint` (CI jobs run `yarn test` and lint in the `core-test` image). The `core/spec/docker/` parity suite is local only: `make docker-parity`.

## Notes

- `make docker-parity` needs a host Docker daemon. If it can't run in this environment, say so in the commit message and the PR description, and list the platform (macOS Docker Desktop / Linux) for any run that was done.

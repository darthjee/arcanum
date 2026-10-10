# Node Plan: Docker engine: parity harness, arcanum-check-config pilot and benchmark

Main plan: [plan.md](plan.md)

## Shared contracts

- `core/spec/support/jasmine-docker.json`: `spec_dir: "spec"`, `spec_files: ["docker/**/*_spec.js"]`.
- `core/package.json` script: `"test:docker": "jasmine --config=spec/support/jasmine-docker.json"`. `infra`'s `make docker-parity` runs it on the host.
- Image tag: read `process.env.ARCANUM_DOCKER_PARITY_IMAGE` (default `darthjee/arcanum:local-test`) in the spec support only, and pass it as `runEngineDispatchFn`'s `image` override.
- Opt-in gates: `ARCANUM_DOCKER_PARITY_GH=1` and `ARCANUM_DOCKER_PARITY_SSH=1`. When unset, the case is `pending('<reason>')`.
- `scripter` changes the pilot shim to `--needs=global-config` and flips `arcanum-check-config` to `"docker"` in `migration-status.json`.

## Steps

- [01 — Parity harness](node/01-parity-harness.md)
- [02 — arcanum-check-config parity case](node/02-check-config-parity-case.md)
- [03 — Pilot routing spec docker callback](node/03-check-config-routing-docker.md)

## CI Checks

- `core/`: `yarn lint` (CI job: `checks`) and `yarn test` (CI job: `test`), locally via `make core-check`. `yarn test` must not pick up `spec/docker/`.
- The parity specs themselves (`yarn test:docker`) are not run in CI.

## Notes

- If Docker isn't available where you implement this, check that the parity spec at least loads, e.g. by confirming it reports a clear failure or skip when Docker is missing. Report that the real parity run wasn't done; the maintainer runs it.

# Issue: Docker engine: parity harness, arcanum-check-config pilot and benchmark

## Description

Part of #729 (epic #724). This is the third of three sub-issues and depends on #740 (the docker branch of `engine_dispatch.sh`, now merged). It adds the local parity harness, makes the pilot entrypoint `arcanum-check-config` docker-ready, and ships the per-call `docker run` benchmark tooling described in `docs/agents/specs/docker/dispatch.md` ("Per-call `docker run`, and when to revisit it").

## Solution

- **Parity harness** (`docs/agents/specs/docker/testing.md`, "Parity specs"):
  - `core/spec/docker/**/*_spec.js` with its own config, `core/spec/support/jasmine-docker.json`. `yarn test` never picks them up.
  - A root `make docker-parity` target next to the `core-*` targets. It builds the `runtime` target as `darthjee/arcanum:local-test` (reusing `core-build-runtime`), then runs the parity config with node on the host.
  - The specs call dispatch through the same `bash -c` wrapper as the dispatch-level specs, with the image tag set as a sourced variable, so they never pull a published image.
  - Opt-in gh/ssh cases run only when `ARCANUM_DOCKER_PARITY_GH=1` or `ARCANUM_DOCKER_PARITY_SSH=1` is set, and are marked pending otherwise.
- **Pilot `arcanum-check-config`** (per "Ticking a checklist row" in testing.md):
  - its shim (`arcanum-check-config/scripts/check_config.sh`) declares `--needs=global-config`, matching the checklist row's mounts/env columns;
  - update the shim's header comment, which still says `engine.mode=docker` errors out for native-only commands;
  - its routing spec (`core/spec/bin/arcanumCheckConfig_spec.js`) gets a `docker` callback for the docker-ready path, replacing the current "not docker-ready yet" expectation;
  - add its parity case under `core/spec/docker/`;
  - flip it to `"docker"` in `arcanum/_lib/migration-status.json`;
  - tick its row in `docs/agents/specs/docker/checklist.md`: status ✅, with `#741` in the `issue` cell.
- **Benchmark tooling**: a bash script (e.g. `scripts/docker_benchmark.sh`) wrapped by a root `make docker-benchmark` target. It times native on the host against `docker run` on the local `runtime` build (`darthjee/arcanum:local-test`) for:
  - `issue-state get`, `resolve-plan-paths` and `auto-fix-all-config-get`, always;
  - `github-issue-info`, only when a sandbox repo and token are configured (same opt-in idea as `ARCANUM_DOCKER_PARITY_GH`), and skipped with a note in the output otherwise. Only the overhead is compared.

  For each command it does 20 warm runs and reports median and p95 wall time for native, for `docker run`, and the overhead between them. A `--cold` option does one labeled run. The maintainer restarts the Docker daemon by hand before using it; the script never restarts the daemon.
- **Manual evidence** (done by the maintainer on the PR, not by the auto pipeline): run `make docker-parity` and the benchmark locally on macOS, and paste the results with the platform into the PR. Linux numbers can come later and don't block the merge. If the warm median overhead is over 1s on Linux or 2s on macOS, open a sub-issue of #724 for the `docker exec` alternative. That doesn't block the pilot.
- **Docs**: rewrite the status section of `docs/agents/specs/docker.md`. It still says no docker execution path is implemented. It should say the docker branch (#740) and the pilot (#741) are done, and mention the parity harness and the benchmark.

## Owner

- node: parity specs, `jasmine-docker.json`, the pilot routing spec.
- infra: `make docker-parity`, the benchmark script and `make docker-benchmark`.
- scripter: the pilot shim declaration and comment, `migration-status.json`.
- architect: the checklist row and the docker.md docs.

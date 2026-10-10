# Plan: Docker engine: parity harness, arcanum-check-config pilot and benchmark

Issue: [741-docker-engine-parity-harness-arcanum-check-config-pilot-and-benchmark.md](../../issues/741-docker-engine-parity-harness-arcanum-check-config-pilot-and-benchmark.md)

## Overview

#740 shipped the docker branch of `engine_dispatch.sh`. This issue makes it usable end to end, in three parts:

- **Parity harness:** host-run Jasmine specs under `core/spec/docker/` that compare a real `darthjee/arcanum:local-test` container with native on the host, driven by `make docker-parity`.
- **Pilot:** `arcanum-check-config` becomes the first command with status `"docker"`.
- **Benchmark:** `scripts/docker_benchmark.sh` and `make docker-benchmark` measure per-call `docker run` overhead.

The design is already settled in `docs/agents/specs/docker/testing.md` ("Parity specs", "Shim-level specs", "Ticking a checklist row") and `docs/agents/specs/docker/dispatch.md` ("Per-call `docker run`, and when to revisit it").

## Agents involved

- [scripter](scripter.md): the pilot shim's `--needs` declaration and the `migration-status.json` flip
- [node](node.md): the parity harness, the pilot's parity case and its routing spec
- [infra](infra.md): `make docker-parity`, the benchmark script and `make docker-benchmark`
- [architect](architect.md): the checklist row and the docker docs

## Shared contracts

- **Image under test:** `darthjee/arcanum:local-test`, the Makefile's existing `RUNTIME_IMAGE` default, built by the existing `core-build-runtime` target. Parity specs read the tag from the env var `ARCANUM_DOCKER_PARITY_IMAGE` (default `darthjee/arcanum:local-test`). Only the spec reads it; the spec then passes it as the sourced `_ENGINE_DISPATCH_DOCKER_IMAGE` override (the `image` override of `runEngineDispatchFn` in `core/spec/support/utils/engineDispatchLib.js`). Production code never reads an env hook for it.
- **Parity config and runner:**
  - config: `core/spec/support/jasmine-docker.json`, `spec_dir: "spec"`, `spec_files: ["docker/**/*_spec.js"]`;
  - runner: a new `core/package.json` script `"test:docker": "jasmine --config=spec/support/jasmine-docker.json"`;
  - `make docker-parity` runs `cd core && yarn install --frozen-lockfile && yarn test:docker` on the **host**, after `core-build-runtime`, with `ARCANUM_DOCKER_PARITY_IMAGE=$(RUNTIME_IMAGE)` exported;
  - `yarn test` keeps using `jasmine.json`, which never matches `docker/`.
- **Opt-in credential cases:** `ARCANUM_DOCKER_PARITY_GH=1` and `ARCANUM_DOCKER_PARITY_SSH=1`. When unset, those cases are `pending(...)` with a reason. The pilot needs neither. The harness only provides the gating helper, so later commands can add such cases.
- **Pilot shim call** (`arcanum-check-config/scripts/check_config.sh`):
  `engine_dispatch "$REPO_PATH" arcanum-check-config "" --native-only --needs=global-config HOME CLAUDE_CONFIG_DIR -- "$REPO_PATH" "$KEY"`.
  Under docker, this mounts the global config read-only and forwards `CLAUDE_CONFIG_DIR`, as the checklist row's `mounts` column (`global-config:ro`) says.
- **Status map:** `arcanum/_lib/migration-status.json` sets `"arcanum-check-config": "docker"`. The scripter flip and node's routing spec change must land together, because the current routing spec expects the "not docker-ready yet" warning.
- **Benchmark interface:** `scripts/docker_benchmark.sh [--runs N] [--cold]`. Defaults to `--runs 20` and uses image `${ARCANUM_BENCH_IMAGE:-darthjee/arcanum:local-test}`. `make docker-benchmark` depends on `core-build-runtime` and passes `ARCANUM_BENCH_IMAGE=$(RUNTIME_IMAGE)`.
  - `github-issue-info` runs only when `ARCANUM_BENCH_GH_REPO=<owner>/<name>` and `ARCANUM_BENCH_GH_ISSUE=<number>` are set and `GH_TOKEN` is set or resolvable through `gh auth token`. Otherwise it prints `skipped: github-issue-info (set ARCANUM_BENCH_GH_REPO and ARCANUM_BENCH_GH_ISSUE)`.
- **Checklist cell:** the `arcanum-check-config` row's `issue` cell is `#741`.

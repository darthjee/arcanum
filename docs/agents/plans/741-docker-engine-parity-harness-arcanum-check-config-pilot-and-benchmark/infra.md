# Infra Plan: Docker engine: parity harness, arcanum-check-config pilot and benchmark

Main plan: [plan.md](plan.md)

## Shared contracts

- `make docker-parity`:
  - depends on `core-build-runtime` (image `$(RUNTIME_IMAGE)`, default `darthjee/arcanum:local-test`);
  - then runs on the host: `cd core && yarn install --frozen-lockfile && ARCANUM_DOCKER_PARITY_IMAGE=$(RUNTIME_IMAGE) yarn test:docker`;
  - `node` adds the `test:docker` script and `core/spec/support/jasmine-docker.json`.
- `scripts/docker_benchmark.sh [--runs N] [--cold]`, image `${ARCANUM_BENCH_IMAGE:-darthjee/arcanum:local-test}`. `make docker-benchmark` depends on `core-build-runtime` and passes `ARCANUM_BENCH_IMAGE=$(RUNTIME_IMAGE)` plus `BENCH_ARGS` through.
- The `github-issue-info` benchmark is opt-in: it runs only with `ARCANUM_BENCH_GH_REPO` and `ARCANUM_BENCH_GH_ISSUE` set and a token available (`GH_TOKEN` or `gh auth token`). Otherwise the script prints one `skipped:` line.

## Implementation Steps

### Step 1 — `make docker-parity`

Add `docker-parity` to the root `Makefile` next to the `core-*` targets and to `.PHONY`. It depends on `core-build-runtime` and runs the parity config with node on the **host**, not inside the `core` compose service, because the specs need the host's Docker CLI. Follow the Makefile's existing convention: extract any path or command (e.g. `CORE_DIR := core`, `PARITY_IMAGE_VAR`) into a variable. Add a comment saying the target is local-only and why it can't run in CI (see testing.md "Not in CI, and why"). Also say that `ARCANUM_DOCKER_PARITY_GH` and `ARCANUM_DOCKER_PARITY_SSH` pass through from the caller's env to enable the opt-in cases.

### Step 2 — Benchmark script and `make docker-benchmark`

Write `scripts/docker_benchmark.sh` (bash 3.2 compatible, `set -euo pipefail`). It measures per-call cost through the real dispatch path, so the availability check and argv construction count as overhead:

1. Create a throwaway fixture repo with `git init` and an initial commit. Seed what each command needs there:
   - an issue file and state for `issue-state get`;
   - `docs/agents/issues` and `docs/agents/plans` for `resolve-plan-paths`;
   - a repo config for `auto-fix-all-config-get`.
2. For each mode (`native`, `docker`), seed `engine.mode` in the fixture's `.claude/state/arcanum-config.json`. Call `engine_dispatch` in a `bash -c` wrapper that sources `arcanum/_lib/engine_dispatch.sh`, the same way `core/spec/support/utils/engineDispatchLib.js` does. The wrapper overrides two sourced variables:
   - `_ENGINE_DISPATCH_MIGRATION_STATUS_FILE`, pointed at a temp map where the four benchmark commands are `"docker"`;
   - `_ENGINE_DISPATCH_DOCKER_IMAGE`, set to `$ARCANUM_BENCH_IMAGE`.

   Use the same `--needs`, `--path-arg`, env and args as each command's real shim (`arcanum/_lib/issue_state.sh`, `arcanum/_lib/resolve_plan_paths.sh`, `auto-fix-all/scripts/config.sh`, and `arcanum/_lib/github_issue.sh` for `github-issue-info`). A command that isn't docker-ready only needs the temp map, not a production change.
3. Run `--runs` (default 20) warm iterations per command and mode. Time each one in milliseconds. Bash 3.2 has no `EPOCHREALTIME`, so use something like `perl -MTime::HiRes` or `python3`, and check that it is on the PATH first. Discard output, but fail loudly on a non-zero exit.
4. Print a table per command: mode, runs, median, p95, and the overhead (docker median minus native median, and the same for p95). Start with a header line naming the platform (`uname -sm`), the Docker server version (`docker version --format '{{.Server.Version}}'`) and the image. That makes the output easy to paste into a PR.
5. `--cold` does one run per command and mode, labeled `cold`. The script doesn't restart the daemon. Its usage text tells the maintainer to restart Docker by hand first.
6. `github-issue-info` runs only when its opt-in env is set. Otherwise it prints a `skipped:` line.
7. Clean up the fixture repo with a `trap`.

Add a `docker-benchmark` target (in `.PHONY`) that depends on `core-build-runtime` and runs the script with `ARCANUM_BENCH_IMAGE=$(RUNTIME_IMAGE)` and `$(BENCH_ARGS)`, e.g. `make docker-benchmark BENCH_ARGS=--cold`.

## Files to Change

- `Makefile`: the `docker-parity` and `docker-benchmark` targets and their `.PHONY` entries.
- `scripts/docker_benchmark.sh` (new, executable): the benchmark.

## Notes

- Neither target runs in CI.
- Before relying on the shims' current dispatch arguments, read each shim. The benchmark must mirror them exactly, or the docker run would measure a different mount set.
- Run `shellcheck scripts/docker_benchmark.sh`. You can smoke-test locally with `--runs 2` if Docker is available. Report in your summary if it isn't.

# Node Plan: Docker engine: migrate GitHub API commands (batch 3)

Main plan: [plan.md](plan.md)

## Shared contracts

Assert the shim flags and resulting `docker run` mounts/env in [plan.md → Shared contracts](plan.md#shared-contracts): the global-config and gitconfig `:ro` mounts, `-e CLAUDE_CONFIG_DIR`, `-e GIT_CONFIG_GLOBAL`, `-e GH_TOKEN` by name only, and the path-arg `:ro` mount when the file is outside the repo. Define and document the sandbox env vars (`ARCANUM_DOCKER_PARITY_GH_REPO`, `_ISSUE`, `_PR`, PR head branch) named there.

## Steps

- [01 — Docker routing callbacks for the batch-3 shims](node/01-docker-routing-callbacks.md)
- [02 — gh sandbox parity harness](node/02-gh-sandbox-harness.md)
- [03 — gh parity cases](node/03-gh-parity-cases.md)

## CI Checks

- `core/`: `make core-test` / `yarn test` and `yarn lint` in `core/` (the existing CI jobs for core).
- Docker parity, local only: `make docker-parity`, then `ARCANUM_DOCKER_PARITY_GH=1 ARCANUM_DOCKER_PARITY_GH_REPO=... ARCANUM_DOCKER_PARITY_GH_ISSUE=... ARCANUM_DOCKER_PARITY_GH_PR=... make docker-parity`. Report the platform and the result in the PR. The gh run is a merge gate.

## Notes

- The passthrough fake `docker` runs `core/bin/arcanum` on the host with the host `PATH`, so the existing `fakeGhBin.js` keeps working under the docker callback. Seed `GH_TOKEN` in the routing case's env so host-side token resolution doesn't call a real `gh auth token`, and assert the value never appears in the fake's argv log.
- `monitor_issues.sh` starts its dispatch in the background (`&`). Check that stopping the shim also stops the container, or report the gap to scripter for the checklist note.

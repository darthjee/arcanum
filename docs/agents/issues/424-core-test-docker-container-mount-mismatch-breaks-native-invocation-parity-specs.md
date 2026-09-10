# Issue: core-test Docker container mount mismatch breaks native-invocation/parity specs

## Description
`core/docker-compose.yml` bind-mounts only `core/` (build context `.`) to `/home/node/app` inside the test container, while `core/lib/utils/file/InstallRoot.js` resolves the install root by walking up 4 parent directories from its own location, expecting the full monorepo root (the arcanum skill repo checkout) to be present on disk at that point.

Inside the container this walk lands on `/home/node` instead of the actual repo root, so any spec that shells out to `core/bin/arcanum` or `arcanum/_lib/*.sh` (native-invocation / parity specs) fails with `ENOENT` / `Cannot find module '/home/node/core/bin/arcanum'`.

This is a pre-existing, infra-owned mismatch — not caused by any single commit — and affects dozens of unrelated parity specs (`githubIssueCreateParity`, `autoFixAllQueueParity`, `autoFixAllGithubParity`, `spawn-issue` parity, etc.), not just any one command's specs.

## Problem
`make core-test` (Docker) currently cannot be trusted to validate native-invocation/parity specs, and no current CI workflow catches this — it's easy to mistake this infra noise for a real regression, or vice versa.

Found while implementing #420: `make core-test` failed with 183 failures, but the equivalent suite run locally outside Docker (`yarn test` in `core/`) passed cleanly (845 specs, 0 failures, 100% coverage), isolating the failures to the container's mount/path mismatch rather than the code change itself.

## Expected Behavior
`make core-test` run via Docker should exercise native-invocation/parity specs successfully (or deliberately and visibly skip/route them), matching the outcome of running `yarn test` locally, so a Docker test run's pass/fail result can be trusted at face value.

## Solution
Mount the full monorepo root into the container instead of just `core/`: change `core/docker-compose.yml`'s bind mount (currently `.:/home/node/app` with build `context: .`, i.e. `core/` only) to mount the repo root, and update `working_dir` (and the `command`'s working directory assumptions) so `yarn install`/`yarn test` still run from `core/` inside the container.

With the full repo present on disk at the same relative layout as a local checkout, `InstallRoot.js`'s existing 4-levels-up walk from `core/lib/utils/file/` resolves correctly without any code change — no `node`-owned changes are needed.

Owned by `infra` (`core/Dockerfile`, `core/docker-compose.yml`).

## Benefits
`make core-test` becomes trustworthy for validating native-invocation/parity specs, removing the current risk of mistaking infra noise for a real regression (or vice versa) and closing the CI gap where this isn't caught today.

# Plan: Dev container and CI for shared/

Issue: [823-dev-container-and-ci-for-shared.md](../../issues/823-dev-container-and-ci-for-shared.md)

## Overview

Give `shared/` a compose service, `shared-*` Makefile targets, CircleCI `shared` and `shared-node-floor` jobs, merged Codacy coverage (partial uploads plus a `coverage-final` job), `.codacy.yml` entries mirroring core's, and packaging-spec guards that `shared/lib/` and `shared/package.json` ship. Single owner: `infra`.

See [infra.md](infra.md) for the full plan.

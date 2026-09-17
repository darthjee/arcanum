# Plan: Codacy: core/Dockerfile runs as root — missing USER directive (2 findings)

Issue: [494-codacy-core-dockerfile-runs-as-root-missing-user-directive-2-findings.md](../issues/494-codacy-core-dockerfile-runs-as-root-missing-user-directive-2-findings.md)

## Overview

Dismiss the two Codacy IaC findings on `core/Dockerfile` (missing `USER` directive) as false positives, with the rationale documented in-repo — the container already drops privileges to `node` at runtime via `docker-entrypoint.sh`'s root-start-then-`su` pattern, and a literal `USER node` directive would break that.

See [infra.md](infra.md) for the full plan.

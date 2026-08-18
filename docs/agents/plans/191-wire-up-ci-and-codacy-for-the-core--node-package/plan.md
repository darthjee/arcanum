# Plan: Wire up CI and Codacy for the core/ Node package

Issue: [191-wire-up-ci-and-codacy-for-the-core--node-package.md](../../issues/191-wire-up-ci-and-codacy-for-the-core--node-package.md)

## Overview

Add the repo's first `.github/workflows/` file for `core/`: a `coverage` job (runs the test suite with coverage via the existing Docker-based `make core-test` target, uploads `core/coverage/lcov.info` to Codacy) and a `checks` job (runs `make core-lint`, blocking, plus new Docker-based Makefile targets for JSCPD duplication and `yarn audit`, non-blocking). Both jobs are scoped to `core/**` changes.

See [infra.md](infra.md) for the full plan.

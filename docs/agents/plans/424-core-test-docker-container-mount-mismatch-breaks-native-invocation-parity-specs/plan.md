# Plan: core-test Docker container mount mismatch breaks native-invocation/parity specs

Issue: [424-core-test-docker-container-mount-mismatch-breaks-native-invocation-parity-specs.md](../../issues/424-core-test-docker-container-mount-mismatch-breaks-native-invocation-parity-specs.md)

## Overview

`core/docker-compose.yml` bind-mounts only `core/` into the test container, but `core/lib/utils/file/InstallRoot.js` expects the full monorepo root on disk when it walks 4 levels up. Mounting the full monorepo root (instead of just `core/`) fixes the mismatch with no code changes needed.

See [infra.md](infra.md) for the full plan.

# Plan: Migrate auto-fix-all-wait-ci entrypoint to native Node.js

Issue: [262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js.md](../issues/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js.md)

## Overview

Port `auto-fix-all/scripts/wait_ci.sh` (blocking poll loop over the GitHub Checks API) to a native `core/lib/AutoFixAllWaitCi.js`, wired through `core/bin/arcanum` and the `engine_dispatch.sh` shim, per `docs/agents/architecture/script-engine.md` and the precedent of the five already-merged sibling migrations (#256–#260).

See [node.md](node.md) for the full plan.

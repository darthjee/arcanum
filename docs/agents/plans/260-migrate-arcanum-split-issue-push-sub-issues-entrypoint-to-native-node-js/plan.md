# Plan: Migrate arcanum-split-issue-push-sub-issues entrypoint to native Node.js

Issue: [260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js.md](../issues/260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js.md)

## Overview

Migrates `arcanum-split-issue/scripts/push_sub_issues.sh` — the batch driver that pushes every generated sub-issue draft file for an issue to GitHub, in ascending count order, stopping at the first failure — to a native Node.js implementation, per `docs/agents/architecture/script-engine.md`. All work is `core/`-scoped, so it's owned entirely by the `node` agent.

See [node.md](node.md) for the full plan.

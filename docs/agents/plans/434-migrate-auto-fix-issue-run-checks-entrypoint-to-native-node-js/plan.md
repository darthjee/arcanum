# Plan: Migrate auto-fix-issue-run-checks entrypoint to native Node.js

Issue: [434-migrate-auto-fix-issue-run-checks-entrypoint-to-native-node-js.md](../issues/434-migrate-auto-fix-issue-run-checks-entrypoint-to-native-node-js.md)

## Overview
Migrate `auto-fix-issue/scripts/run_checks.sh` to a native Node.js command per `docs/agents/architecture/script-engine.md`, entirely within the `node` agent's scope — no other agent has work on this sub-issue.

See [node.md](node.md) for the full plan.

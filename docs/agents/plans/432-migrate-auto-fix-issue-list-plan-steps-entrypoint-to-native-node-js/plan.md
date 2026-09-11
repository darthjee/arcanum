# Plan: Migrate auto-fix-issue-list-plan-steps entrypoint to native Node.js

Issue: [432-migrate-auto-fix-issue-list-plan-steps-entrypoint-to-native-node-js.md](../issues/432-migrate-auto-fix-issue-list-plan-steps-entrypoint-to-native-node-js.md)

## Overview
Migrates `auto-fix-issue/scripts/list_plan_steps.sh` to a native `core/lib/` Node.js command, following the same shell-impl/engine_dispatch-shim split already used for its sibling `auto-fix-issue-list-plan-agents` (#431) — the closest precedent, sharing the same plan-dir convention and taking no `repo_path` argument of its own.

See [node.md](node.md) for the full plan.

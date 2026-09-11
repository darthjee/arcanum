# Plan: Migrate auto-fix-issue-merge-main entrypoint to native Node.js

Issue: [433-migrate-auto-fix-issue-merge-main-entrypoint-to-native-node-js.md](../../issues/433-migrate-auto-fix-issue-merge-main-entrypoint-to-native-node-js.md)

## Overview

Migrates `auto-fix-issue/scripts/merge_main.sh` (merges `origin/main` into the currently checked-out issue branch, reporting `STATUS=ok`/`STATUS=conflict`) to a native Node.js command, following the pattern already used for the sibling `auto-fix-issue` entrypoints migrated in the #427 batch (`create-branch`, `commit-change`, `github`, `list-plan-agents`).

See [node.md](node.md) for the full plan.

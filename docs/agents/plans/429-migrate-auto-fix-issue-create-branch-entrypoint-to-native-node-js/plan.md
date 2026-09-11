# Plan: Migrate auto-fix-issue-create-branch entrypoint to native Node.js

Issue: [429-migrate-auto-fix-issue-create-branch-entrypoint-to-native-node-js.md](../issues/429-migrate-auto-fix-issue-create-branch-entrypoint-to-native-node-js.md)

## Overview
Migrates `auto-fix-issue/scripts/create_branch.sh` to a native Node.js command (`AutoFixIssueCreateBranch`), following the shell-split + `engine_dispatch` shim pattern already used for the `auto-fix-issue-commit-change` migration (#428).

See [node.md](node.md) for the full plan.

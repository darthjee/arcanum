# Plan: Migrate auto-fix-all-github entrypoint (pr-number, pr-state, pr-merge, cleanup-branch, has-shipit-label, add-tag, remove-tag) to native Node.js

Issue: [265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js.md](../issues/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js.md)

## Overview

Migrate `auto-fix-all/scripts/github.sh`'s 7 subcommands (`pr-number`, `pr-state`, `pr-merge`, `cleanup-branch`, `has-shipit-label`, `add-tag`, `remove-tag`) to a native `core/lib/AutoFixAllGithub.js`, all changes scoped to `core/` — entirely the `node` agent's territory.

See [node.md](node.md) for the full plan.

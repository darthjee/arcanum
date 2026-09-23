# Plan: Migrate init-claude entrypoints to native Node.js

Issue: [585-migrate-init-claude-entrypoints-to-native-node-js.md](../../issues/585-migrate-init-claude-entrypoints-to-native-node-js.md)

## Overview

#585 is a parent issue. All code changes are made in its three independent sub-issues, and each one gets its own plan and PR. This plan only tracks them and defines the final check that closes #585.

## Context

The 6 `init-claude` entrypoints (`init-claude/scripts/*.sh` plus the shared `lib/label_config.sh`) are still `false` in `arcanum/_lib/migration-status.json`. The work is split as follows:

| Sub-issue | Scope | Agents |
| --- | --- | --- |
| #592 | `set-ci-ignored-patterns`, `setup-templates`, `stamp-arcanum-version` (reuses `ArcanumUpdateRunUpdate` version resolution) | scripter, node |
| #593 | `setup-docs-structure` | scripter, node |
| #594 | `label_config` shared module, `write-label-config-{replace,remove,add}`, `sync-labels` | scripter, node |

## Implementation Steps

### Step 1 — Deliver the sub-issues

Plan and fix #592, #593 and #594 through the normal pipeline (`/discuss-issue` or `/auto-plan-issue`, then `/auto-fix-issue`). They don't depend on each other and can be done in any order. The only file they all change is the generated `docs/agents/architecture/entrypoint-migration-status.md`. A PR that merges later just rebases and re-runs `scripts/generate_entrypoint_migration_status.sh`.

### Step 2 — Final check, then close

After all three are merged, confirm on `main` that:

- `arcanum/_lib/migration-status.json` has no `init-claude-*` key left `false`. The single `init-claude-write-label-config` key has been replaced by `-replace`, `-remove` and `-add`.
- `docs/agents/architecture/entrypoint-migration-status.md` matches what `scripts/generate_entrypoint_migration_status.sh` produces.

Then close #585. No code change is expected in this step. If a check fails, fix it in the sub-issue that caused it, or in a small follow-up.

## Files to Change

None directly. All changes happen in #592, #593 and #594.

## Notes

- Don't run `/auto-fix-issue 585` directly, because it has nothing to implement. Queue the sub-issues instead.

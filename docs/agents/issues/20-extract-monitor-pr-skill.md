# Issue: Extract Monitor pr skill

## Description
Right now, monitoring a PR is part of `auto-fix-all`. We need to extract this behavior into dedicated skills and make `auto-fix-all` use them instead of handling it inline.

## Problem
- PR monitoring logic is embedded directly inside `auto-fix-all`, instead of being a reusable, standalone skill.

## Expected Behavior
- `auto-fix-all` delegates PR monitoring to a dedicated skill instead of implementing it itself.
- The new skills reuse the script that already implements the monitoring logic.

## Solution
- Create `auto-monitor-issue-pr`: used by `auto-fix-all`, reuses the existing script, and behaves the same way already defined — using an issue id to monitor a PR for comments or changes in status.
- Create `auto-monitor-pr`: similar to `auto-monitor-issue-pr`, but receives a PR id directly instead of an issue id.

## Benefits
- Reusable, standalone PR monitoring skills that can be used outside of `auto-fix-all`.
- Clearer separation of concerns within `auto-fix-all`.

---
See issue for details: https://github.com/darthjee/arcanum/issues/20

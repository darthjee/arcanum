# Plan: Codacy: duplication cluster — AutoFixIssue Github state-sync/pr-ready/pr-view trio (21 clone groups, 3 files)

Issue: [549-codacy-duplication-cluster-autofixissue-github-state-sync-pr-ready-pr-view-trio-21-clone-groups-3-files.md](../issues/549-codacy-duplication-cluster-autofixissue-github-state-sync-pr-ready-pr-view-trio-21-clone-groups-3-files.md)

## Overview

This is a `core/spec/` test-only duplication cleanup: collapse the repeated github-state-sync setup/assertion fragments shared across three `auto-fix-issue` specs into a shared fixture and shared example.

See [node.md](node.md) for the full plan.

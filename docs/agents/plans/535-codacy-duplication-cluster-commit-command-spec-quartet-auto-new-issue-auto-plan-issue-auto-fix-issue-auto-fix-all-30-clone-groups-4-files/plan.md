# Plan: Codacy: duplication cluster — commit-command spec quartet (auto-new-issue/auto-plan-issue/auto-fix-issue/auto-fix-all) (~30 clone groups, 4 files)

Issue: [535-codacy-duplication-cluster-commit-command-spec-quartet-auto-new-issue-auto-plan-issue-auto-fix-issue-auto-fix-all-30-clone-groups-4-files.md](../issues/535-codacy-duplication-cluster-commit-command-spec-quartet-auto-new-issue-auto-plan-issue-auto-fix-issue-auto-fix-all-30-clone-groups-4-files.md)

## Overview
Extract the duplicated repo/git-mock bootstrap and repeated commit-message assertion logic shared by four commit-command specs into a parameterized factory + helper under `core/spec/support/factories/`, following this repo's existing factory-function convention.

See [node.md](node.md) for the full plan.

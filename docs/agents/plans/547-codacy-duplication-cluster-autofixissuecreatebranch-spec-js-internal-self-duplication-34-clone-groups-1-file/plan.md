# Plan: Codacy: duplication cluster — AutoFixIssueCreateBranch_spec.js internal self-duplication (34 clone groups, 1 file)

Issue: [547-codacy-duplication-cluster-autofixissuecreatebranch-spec-js-internal-self-duplication-34-clone-groups-1-file.md](../issues/547-codacy-duplication-cluster-autofixissuecreatebranch-spec-js-internal-self-duplication-34-clone-groups-1-file.md)

## Overview

Extract a shared `runCreateBranch` setup helper in `AutoFixIssueCreateBranch_spec.js` to remove the repeated arrange/act boilerplate across 6 tests, eliminating the Codacy-flagged internal self-duplication in this single spec file.

See [node.md](node.md) for the full plan.

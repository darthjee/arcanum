# Plan: Codacy: duplication cluster — MergeBodyResolver_spec.js self-duplication + PrOperationsPrMerge_spec.js (17 clone groups, 2 files)

Issue: [548-codacy-duplication-cluster-mergebodyresolver-spec-js-self-duplication-properationsprmerge-spec-js-17-clone-groups-2-files.md](../issues/548-codacy-duplication-cluster-mergebodyresolver-spec-js-self-duplication-properationsprmerge-spec-js-17-clone-groups-2-files.md)

## Overview

Extract a callback-based shared example, modeled on `registerGithubIssueCreateSharedExamples`, that captures the merge-body-resolution assertions (`empty`/`full`/`coauthors` modes) common to `MergeBodyResolver_spec.js` (unit layer, asserts on `MergeBodyResolver#buildBody`'s return value) and `PrOperationsPrMerge_spec.js` (integration layer, asserts on `githubClient.mergePr`'s call args). Both files then reuse it in place of their duplicated blocks.

See [node.md](node.md) for the full plan.

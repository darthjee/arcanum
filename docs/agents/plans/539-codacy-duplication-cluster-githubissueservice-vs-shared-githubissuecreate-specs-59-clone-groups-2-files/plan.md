# Plan: Codacy: duplication cluster — GithubIssueService vs. shared GithubIssueCreate specs (59 clone groups, 2 files)

Issue: [539-codacy-duplication-cluster-githubissueservice-vs-shared-githubissuecreate-specs-59-clone-groups-2-files.md](../issues/539-codacy-duplication-cluster-githubissueservice-vs-shared-githubissuecreate-specs-59-clone-groups-2-files.md)

## Overview

Extract the duplicated "create issue" test scenarios shared between `GithubIssueService_spec.js` and `GithubIssueCreate_spec.js` into a new `githubIssueCreateSharedExamples.js` shared-example file, following the existing `core/spec/support/sharedExamples/` convention, then have both specs consume it and keep only their own wrapper-specific tests.

See [node.md](node.md) for the full plan.

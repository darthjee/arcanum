# Plan: Codacy: duplication cluster — IssueLinker_spec.js self-duplication + LabelApplicator_spec.js (14 clone groups, 2 files)

Issue: [553-codacy-duplication-cluster-issuelinker-spec-js-self-duplication-labelapplicator-spec-js-14-clone-groups-2-files.md](../../issues/553-codacy-duplication-cluster-issuelinker-spec-js-self-duplication-labelapplicator-spec-js-14-clone-groups-2-files.md)

## Overview
This is a test-only refactor. It adds one command-agnostic `execFileAsync` fake under `core/spec/support/utils/` and moves five hand-rolled `gh`/`git` dispatcher fakes onto it. It also collapses `IssueLinker_spec.js`'s three identical sub-issue link-failure tests into one parameterized test, and removes the repeated arrange/act blocks in `IssueLinker_spec.js` and `LabelApplicator_spec.js`.

See [node.md](node.md) for the full plan.

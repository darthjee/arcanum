# Plan: Codacy: duplication cluster — IssueClient_spec.js internal self-duplication (23 clone groups, 1 file)

Issue: [545-codacy-duplication-cluster-issueclient-spec-js-internal-self-duplication-23-clone-groups-1-file.md](../../issues/545-codacy-duplication-cluster-issueclient-spec-js-internal-self-duplication-23-clone-groups-1-file.md)

## Overview

Refactor `core/spec/lib/utils/github/IssueClient_spec.js` to remove its internal duplication: the "not ok" and "fetch rejects" error-boilerplate tests repeated across `addLabel`, `removeLabel`, `createIssue`, and `postComment` collapse into a single case-table + `for...of` loop, matching the precedent already established in `GithubToken_spec.js`.

See [node.md](node.md) for the full plan.

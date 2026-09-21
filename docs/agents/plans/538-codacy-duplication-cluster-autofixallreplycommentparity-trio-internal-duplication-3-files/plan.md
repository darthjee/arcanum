# Plan: Codacy: duplication cluster — autoFixAllReplyCommentParity trio internal duplication (3 files)

Issue: [538-codacy-duplication-cluster-autofixallreplycommentparity-trio-internal-duplication-3-files.md](../issues/538-codacy-duplication-cluster-autofixallreplycommentparity-trio-internal-duplication-3-files.md)

## Overview
Extract the shared shell-vs-native parity fixture lifecycle (fake `gh` binary, two git fixture repos, seeding, running both implementations, cleanup) that `preconditions_spec.js`'s "no pull request found" case, `rest_failure_spec.js`, and `happy_path_spec.js` currently duplicate almost verbatim into a single parameterized helper in `core/spec/support/factories/autoFixAllReplyCommentParitySetup.js`.

See [node.md](node.md) for the full plan.

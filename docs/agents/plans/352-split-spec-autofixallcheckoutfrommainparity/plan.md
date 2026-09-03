# Plan: Split spec AutoFixAllCheckoutFromMainParity

Issue: [352-split-spec-autofixallcheckoutfrommainparity.md](../../issues/352-split-spec-autofixallcheckoutfrommainparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` (347 lines,
7 `describe` blocks), following the same shape as issues #347 and #350: extract the shared
git-fixture helpers into a support factory module, then split the describes into three files
by concern (branch-topology happy paths, the merge-conflict case, and argument validation)
under a new `autoFixAllCheckoutFromMainParity/` directory. No behavior, assertion, or
entrypoint change.

See [node.md](node.md) for the full plan.

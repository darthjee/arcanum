# Plan: Split spec ArcanumSplitIssueCreateSubIssueParity

Issue: [354-split-spec-arcanumsplitissuecreatesubissueparity.md](../issues/354-split-spec-arcanumsplitissuecreatesubissueparity.md)

## Overview

Spec-only reorganization: split the 285-line
`core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js` parity monolith into a
`arcanumSplitIssueCreateSubIssueParity/` directory with `argument_validation_spec.js` (six
validation blocks) and `retry_exhausted_spec.js` (one behavioral block), extracting the
shared helpers into
`core/spec/support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js`. Every `it`
moves verbatim; no production code changes. All work is within `core/spec/`, owned solely
by the `node` agent.

See [node.md](node.md) for the full plan.

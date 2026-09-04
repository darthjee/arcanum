# Plan: Split spec ArcanumSplitIssuePushSubIssuesParity

Issue: [359-split-spec-arcanumsplitissuepushsubissuesparity.md](../issues/359-split-spec-arcanumsplitissuepushsubissuesparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js`
(260 lines) into two smaller files under a new `arcanumSplitIssuePushSubIssuesParity/`
directory, plus a shared helper module — mirroring the split already applied to
`arcanumSplitIssueCreateSubIssueParity_spec.js` (issue #354) and the other recent parity-spec
splits (#355–#358). No production code changes.

See [node.md](node.md) for the full plan.

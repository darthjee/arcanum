# Plan: Split spec IssueStateService

Issue: [366-split-spec-issuestateservice.md](../issues/366-split-spec-issuestateservice.md)

## Overview

Spec-only reorganization of `core/spec/lib/services/IssueStateService_spec.js` (281 lines)
into 3 sibling files grouped by conceptual behavior, per the axis already decided in the
issue. No production code changes.

See [node.md](node.md) for the full plan.

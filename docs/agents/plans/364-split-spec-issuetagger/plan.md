# Plan: Split spec IssueTagger

Issue: [364-split-spec-issuetagger.md](../issues/364-split-spec-issuetagger.md)

## Overview

Spec-only reorganization of `core/spec/lib/utils/issue/IssueTagger_spec.js` (304 lines) into
three sibling files split by behavioral weight — `#markEnqueued` and `#mutateTag` each get
their own file, the five thin wrapper methods share one file — plus a new shared factory
module for the inline `fakeIssueClient`/`newTagger` helpers. No production code changes.

See [node.md](node.md) for the full plan.

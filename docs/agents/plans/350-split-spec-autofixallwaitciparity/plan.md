# Plan: Split spec AutoFixAllWaitCiParity

Issue: [350-split-spec-autofixallwaitciparity.md](../issues/350-split-spec-autofixallwaitciparity.md)

## Overview

Split `core/spec/bin/autoFixAllWaitCiParity_spec.js` (431 lines, 8 `describe` blocks) into
three focused spec files under a new `core/spec/bin/autoFixAllWaitCiParity/` directory,
mirroring the existing `autoFixAllGithubParity/`/`autoFixAllQueueParity/` split convention.
Pure spec-only reorganization — entirely within `core/`, so this is single-owner work for the
`node` agent.

See [node.md](node.md) for the full plan.

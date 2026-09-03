# Plan: Split spec AutoFixAllReplyCommentParity

Issue: [356-split-spec-autofixallreplycommentparity.md](../issues/356-split-spec-autofixallreplycommentparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/autoFixAllReplyCommentParity_spec.js` (275 lines,
6 single-`it` `describe` blocks) into a `core/spec/bin/autoFixAllReplyCommentParity/`
directory of three files split by concern, with the shared local helpers extracted into
`core/spec/support/factories/autoFixAllReplyCommentParitySetup.js`. No production code
changes; every `it` moves verbatim.

See [node.md](node.md) for the full plan.

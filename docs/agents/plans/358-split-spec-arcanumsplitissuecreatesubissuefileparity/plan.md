# Plan: Split spec ArcanumSplitIssueCreateSubIssueFileParity

Issue: [358-split-spec-arcanumsplitissuecreatesubissuefileparity.md](../issues/358-split-spec-arcanumsplitissuecreatesubissuefileparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js`
(264 lines, 8 `describe` blocks) into a new
`core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/` directory holding two files —
`argument_validation_spec.js` (the seven validation blocks) and `success_path_spec.js` (the
one substantive block) — with the shared `runCommand` / `runBoth` helpers and the
`REPO_ROOT` / `SHELL_SCRIPT` / `NATIVE_BIN` constants moved into a new
`core/spec/support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js` module. No
production code changes; every `it` moves verbatim. This mirrors the split already landed for
the sibling `create_sub_issue` entrypoint under issue #354 and, most recently, `issueState`
under issue #357.

All work is inside `core/`, so this plan has a single owner: the `node` agent.

See [node.md](node.md) for the full plan.

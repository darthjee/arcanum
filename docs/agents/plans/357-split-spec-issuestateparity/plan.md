# Plan: Split spec IssueStateParity

Issue: [357-split-spec-issuestateparity.md](../issues/357-split-spec-issuestateparity.md)

## Overview

Spec-only reorganization of `core/spec/bin/issueStateParity_spec.js` (269 lines, 13
`describe`/`it` blocks) into a `core/spec/bin/issueStateParity/` directory of five
per-subcommand files, with the shared `runBoth` / `assertStateFilesMatch` helpers extracted
into `core/spec/support/factories/issueStateParitySetup.js` and rewritten to take the
fixture-repo pair as explicit parameters. No production code changes; every `it` moves with
its assertions unchanged.

See [node.md](node.md) for the full plan.

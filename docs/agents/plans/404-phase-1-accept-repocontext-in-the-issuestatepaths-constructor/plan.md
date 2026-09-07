# Plan: Phase 1: Accept repoContext in the IssueStatePaths constructor

Issue: [404-phase-1-accept-repocontext-in-the-issuestatepaths-constructor.md](../issues/404-phase-1-accept-repocontext-in-the-issuestatepaths-constructor.md)

## Overview

Phase 1 of the #397 phased migration. Give `core/lib/utils/file/IssueStatePaths.js` a
`constructor({ repoContext } = {})` that stores an optional `repoContext`, and make
`paths(repoPath, id)` fall back to `this._repoContext?.repoPath` when its `repoPath`
argument is omitted — an explicitly passed `repoPath` still wins. No caller changes and no
behaviour change for existing callers; the three call sites move in Phase 2 and the
`repoPath` parameter is removed in Phase 3. All work is in `core/`, owned by the `node`
agent.

See [node.md](node.md) for the full plan.

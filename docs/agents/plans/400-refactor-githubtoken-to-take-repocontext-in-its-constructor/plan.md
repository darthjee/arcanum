# Plan: Refactor GithubToken to take repoContext in its constructor

Issue: [400-refactor-githubtoken-to-take-repocontext-in-its-constructor.md](../../issues/400-refactor-githubtoken-to-take-repocontext-in-its-constructor.md)

## Overview

Give `GithubToken` an optional `repoContext` constructor parameter (with a permanent
per-call `repoPath` fallback), do the same for `services/GithubIssueService.js` using a
duck-typed `{ repoPath }` shape — no `import` of `context/` — and migrate the
`context/RepoContext.js` call site so it stops threading `repoPath`. Document the narrow
`services/` layering carve-out in `script-engine.md`. All work is inside `core/`, owned by
the `node` agent.

See [node.md](node.md) for the full plan.

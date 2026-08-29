# Plan: Cleanup: remove the dispatch-fixture-repo-context scaffold and stale takesRepoContext references

Issue: [314-cleanup-remove-the-dispatch-fixture-repo-context-scaffold-and-stale-takesrepocontext-references.md](../../issues/314-cleanup-remove-the-dispatch-fixture-repo-context-scaffold-and-stale-takesrepocontext-references.md)

## Overview

Final scaffold teardown for #308 (sub-issue 6). #321 already shipped the
substantive part of this sub-issue — the `context: 'repo' | 'claude' | 'none'`
enum replacing the `takesRepoContext` boolean, unconditional `repoContext`
construction, and the exempt-command documentation. All that is left is deleting
the throwaway `dispatch-fixture-repo-context` command (registry entry + module +
spec), re-anchoring its dispatcher-spec coverage onto a real `context: 'repo'`
command, trimming it from `commands_spec.js`'s expected list, and rewording the
handful of now-stale `takesRepoContext` mentions in comments. Behaviour-neutral:
no production dispatch path changes, and the fixture is test-only (`log: false`,
never called from any skill `.md`).

Nearly all the work is in `core/lib` / `core/spec` and belongs to **node** — see
[node.md](node.md) for the full plan. One small architecture-doc edit
(`docs/agents/architecture/script-engine.md` line ~61) is architect-owned; see
Notes.

## Notes

- **`docs/agents/architecture/script-engine.md` line ~61** still describes the
  pre-migration dispatch shape — "instantiates every command with zero
  constructor arguments and passes `repoPath` only as a per-call method
  argument … builds it fresh per call via a small private helper — see
  `AutoFixAllGithub#_prOperations`" — which is stale after #311/#312/#321
  (`_prOperations` was deleted in #312). #321's plan explicitly deferred this
  rewording to "#314's cleanup". It is slightly beyond the issue's literal text
  but squarely within its "reword any remaining language that frames the
  `context` enum as a temporary migration step" intent. The **architect** makes
  this edit directly (architecture docs are not in `node`'s scope): reword line
  ~61 to describe the settled `context` enum — the dispatcher builds a
  `RepoContext` (or `ClaudeContext`) per `context`-bound entry and injects it at
  construction; line ~55 already lists `context/` bundles correctly and needs no
  change.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

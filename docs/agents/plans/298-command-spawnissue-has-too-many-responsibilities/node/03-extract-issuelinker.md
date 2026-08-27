# Extract IssueLinker

Extract `SpawnIssue#_linkBack`, `#_linkSubIssue`, and `#_nodeId` (core/lib/commands/SpawnIssue.js:203-279) into a new standalone class, `core/lib/utils/issue/IssueLinker.js` — same rationale and folder as `LabelApplicator` (node/02).

Preserve behavior exactly:
- Always comments on the parent (`Spawned issue #<newId>: <title>`) and on the new issue (`Spawned from #<parentId>`), each independently best-effort (a failure on one doesn't block the other).
- When `asSubissue` is true, additionally resolves both issues' GraphQL node ids (`gh issue view ... --json id -q .id`) and runs the `addSubIssue` mutation; on any failure (missing node id or mutation failure) warns to stderr that the issue was "created but not linked; link it manually on GitHub". Never throws.
- `_nodeId(id, repoRef)` stays as an internal/private helper of this class (the issue text calls it `_fetchNodeId`, but the actual current method name in `SpawnIssue.js` is `_nodeId` — keep that name for continuity).

Constructor takes `execFileAsync` (injectable) — same rationale as `LabelApplicator`, no `repoPath`/`RepoContext` needed.

Public method: `async link(parentId, newId, title, repoRef, asSubissue)` — same signature shape as today's `_linkBack(parentId, newId, title, repoRef, asSubissue)`.

## Files to Change

- New: `core/lib/utils/issue/IssueLinker.js` — the extracted class (`execFileAsync` constructor dep, `link(parentId, newId, title, repoRef, asSubissue)` method, `ADD_SUB_ISSUE_MUTATION` constant moved here, `_nodeId`/`_linkSubIssue` as private helpers).
- New: `core/spec/lib/utils/issue/IssueLinkerSpec.js` — port the linking test cases currently in `core/spec/lib/commands/SpawnIssue_spec.js` (comment-only linking, sub-issue linking success, node-id lookup failure, mutation failure).

# Extract LabelApplicator

Extract `SpawnIssue#_applyLabels` (core/lib/commands/SpawnIssue.js:160-188) into a new standalone class, `core/lib/utils/issue/LabelApplicator.js` — matching the existing `Tags.js`/`IssueTagger.js` convention in that folder (internal helpers, not CLI subcommands; `core/lib/commands/` is strictly 1:1 with `core/bin/arcanum`'s dispatch table, and this isn't a standalone subcommand).

Preserve behavior exactly:
- Fetches `parentId`'s labels via `gh issue view <parentId> -R <repoRef> --json labels -q '.labels[].name'`.
- Filters out any label that maps to a canonical pipeline tag (`Tags.extractTags`).
- Always appends the `Spawned` label.
- Applies via `gh issue edit <newId> -R <repoRef> --add-label ...`.
- Best-effort throughout — on the labels-fetch failure, falls back to applying only `Spawned`; on the edit failure, warns to stderr. Never throws.

Constructor takes `execFileAsync` (injectable, defaulting to the same promisified `execFile` `SpawnIssue` uses today) — no `repoPath`/`RepoContext` needed, since every `gh` call here already takes `repoRef` explicitly as a parameter, not derived from a context.

Public method: `async apply(parentId, newId, repoRef)` — same signature shape as today's `_applyLabels(parentId, newId, repoRef)`.

## Files to Change

- New: `core/lib/utils/issue/LabelApplicator.js` — the extracted class (`execFileAsync` constructor dep, `apply(parentId, newId, repoRef)` method, `SPAWNED_LABEL` constant moved here).
- New: `core/spec/lib/utils/issue/LabelApplicatorSpec.js` — port the label-application test cases currently in `core/spec/lib/commands/SpawnIssue_spec.js` (labels fetched/filtered/applied, parent-fetch failure fallback, edit failure warning).

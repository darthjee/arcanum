# Rename the class away from IssueFile

The issue's **Phase 4**. The class is now an instantiable, `repoContext`-bound lookup /
title-derivation helper — it never held a single file, and now doesn't even take a file
path at construction. Rename it so the name matches.

## Naming

Recommended: **`IssueFileLocator`** (it locates an issue file by id and derives its title
from the filename). `IssueFiles` or `IssueFileLookup` are acceptable alternatives — pick
one and use it consistently. The rest of this step assumes `IssueFileLocator`.

## What to do

1. `git mv core/lib/utils/file/IssueFile.js core/lib/utils/file/IssueFileLocator.js` and
   rename the class declaration + `export default`. Update the class JSDoc's own name
   references.
2. `git mv core/spec/lib/utils/file/IssueFile_spec.js
   core/spec/lib/utils/file/IssueFileLocator_spec.js`; change the top-level
   `describe('IssueFile', ...)` to `describe('IssueFileLocator', ...)`, the import
   specifier, and the local variable names (`issueFile` → `locator`, or keep `issueFile` —
   just be consistent).
3. Update imports and identifiers in the three call sites:
   - `core/lib/commands/shared/ResolveAndFetch.js` — `import IssueFileLocator from
     '../../utils/file/IssueFileLocator.js';`, `issueFile = new IssueFileLocator(repoContext)`
     in `deps`, and the JSDoc `@param` type for the injected collaborator.
   - `core/lib/commands/shared/ResolvePlanPaths.js` — import + `new IssueFileLocator(...)`.
   - `core/lib/commands/shared/ResolveIdAndFile.js` — import + `new IssueFileLocator(...)`.
4. Update the stale doc reference in `core/lib/utils/file/IssueStatePaths.js` (the
   line reading ``* `IssueFile.js`'s docs-issue markdown lookup.``) to the new filename.
5. Grep `core/` once more for `IssueFile` (word-boundary) to catch any missed JSDoc
   `{IssueFile}` type annotations or comments — e.g. in `ResolveAndFetch.js`'s `deps`
   docs. Do **not** touch `ArcanumSplitIssueCreateSubIssueFile` / `subIssueFile` — those
   are an unrelated name.
6. Leave historical `docs/agents/issues/*` and `docs/agents/plans/*` files (including this
   one) untouched — they are point-in-time records.

## Files to Change

- `core/lib/utils/file/IssueFile.js` → `core/lib/utils/file/IssueFileLocator.js` (`git mv`
  + class/export rename + JSDoc).
- `core/spec/lib/utils/file/IssueFile_spec.js` →
  `core/spec/lib/utils/file/IssueFileLocator_spec.js` (`git mv` + `describe` + import +
  identifiers).
- `core/lib/commands/shared/ResolveAndFetch.js` — import, constructor call, JSDoc type.
- `core/lib/commands/shared/ResolvePlanPaths.js` — import, constructor call.
- `core/lib/commands/shared/ResolveIdAndFile.js` — import, constructor call.
- `core/lib/utils/file/IssueStatePaths.js` — update the `IssueFile.js` doc mention.

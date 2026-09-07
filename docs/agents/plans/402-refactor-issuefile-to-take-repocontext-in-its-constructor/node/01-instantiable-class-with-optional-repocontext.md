# Make IssueFile an instantiable class with an optional repoContext

Covers the issue's **Phase 0** (static → instance) and **Phase 1** (accept `repoContext`
in the constructor, with a per-call `repoPath` fallback on `findExisting`). After this step
the class works in both calling styles simultaneously, with spec coverage for each, and no
call site has changed behavior yet.

## What to do

### `core/lib/utils/file/IssueFile.js`

1. Add a constructor: `constructor(repoContext) { this._repoContext = repoContext; }`.
   `repoContext` is **optional** at this step (a bare `new IssueFile()` must still work).
   Follow the `RepoConfig.js` / `BranchCleanup.js` shape — just store it, no validation.
2. Drop `static` from **both** methods:
   - `async findExisting(repoPath, issuesFolder, id)` — keep the `repoPath` parameter, but
     resolve the effective path as `const effectiveRepoPath = repoPath ?? this._repoContext?.repoPath;`
     and use that in the `readdir(path.join(effectiveRepoPath, issuesFolder))` call. The
     fallback only kicks in when `repoPath` is omitted/falsy — an explicit per-call
     `repoPath` still wins (dual-mode transition guarantee). Body is otherwise unchanged.
   - `titleFromFilename(filePath)` — drop `static`, body byte-identical, **no** `repoPath`
     and **no** fallback. It only becomes an instance method for a uniform surface.
3. JSDoc: add the class/constructor `@param {import('../../context/RepoContext.js').default}
   [repoContext]` line and document the fallback; mark `findExisting`'s `repoPath` as
   optional (`[repoPath]`). Keep the existing "used by both `ResolveAndFetch` and
   `ResolveIdAndFile`" class comment, updating any wording that implies the helpers are
   static.

### Call sites — instantiate, keep passing `repoPath` (no behavior change)

- `core/lib/commands/shared/ResolveAndFetch.js` — it already injects collaborators through
  `deps` (`safeBranch`, `githubIssue`). Add `issueFile = new IssueFile()` to the `deps`
  destructuring, store `this._issueFile = issueFile`, and change the two `run()` calls to
  `this._issueFile.findExisting(repoPath, issuesFolder, id)` and
  `this._issueFile.titleFromFilename(existing)`. Still passing `repoPath` explicitly.
- `core/lib/commands/shared/ResolvePlanPaths.js` — no `deps` surface. In `run()`, add
  `const issueFile = new IssueFile();` and call `issueFile.findExisting(repoPath,
  issuesFolder, id)`.
- `core/lib/commands/shared/ResolveIdAndFile.js` — no `deps` surface. Construct `const
  issueFile = new IssueFile();` in `run()` and thread it into `_resolveA` / `_resolveC`
  (add an `issueFile` parameter to both), replacing the three static
  `IssueFile.findExisting(...)` / `IssueFile.titleFromFilename(...)` calls with instance
  calls. Still passing `repoPath` explicitly.

### `core/spec/lib/utils/file/IssueFile_spec.js`

1. Rename the describe blocks from static notation to instance notation:
   `describe('.findExisting')` → `describe('#findExisting')`,
   `describe('.titleFromFilename')` → `describe('#titleFromFilename')`.
2. Convert every existing example to construct an instance:
   - `#findExisting` cases: `const issueFile = new IssueFile();` then
     `issueFile.findExisting(repoPath, issuesFolder, '1')` — existing per-call `repoPath`
     behavior preserved.
   - `#titleFromFilename` cases: `const issueFile = new IssueFile();` then
     `issueFile.titleFromFilename('docs/agents/issues/42_my_cool_issue.md')`.
3. Add a new `#findExisting` context that constructs with a `repoContext` and omits
   `repoPath` per call:
   `const issueFile = new IssueFile(createRepoContextMock({ repoPath }));` then
   `issueFile.findExisting(undefined, issuesFolder, '42')` — assert it matches the same
   file the per-call-`repoPath` case does. Import `createRepoContextMock` from
   `../../../support/factories/repoContextFactory.js`.
4. Add one case asserting an explicit per-call `repoPath` still wins when a `repoContext`
   with a **different** path was injected at construction.

## Files to Change

- `core/lib/utils/file/IssueFile.js` — add constructor storing optional `repoContext`;
  both methods become instance methods; `findExisting` falls back to
  `this._repoContext?.repoPath` when `repoPath` is omitted; JSDoc updated.
- `core/lib/commands/shared/ResolveAndFetch.js` — inject `issueFile = new IssueFile()` via
  `deps`; call instance methods (still passing `repoPath`).
- `core/lib/commands/shared/ResolvePlanPaths.js` — construct `new IssueFile()` in `run()`;
  call instance `findExisting` (still passing `repoPath`).
- `core/lib/commands/shared/ResolveIdAndFile.js` — construct `new IssueFile()` in `run()`,
  thread it into `_resolveA` / `_resolveC`; call instance methods (still passing
  `repoPath`).
- `core/spec/lib/utils/file/IssueFile_spec.js` — instance-notation describe blocks;
  instance construction in every example; new `repoContext`-constructed coverage and an
  explicit-`repoPath`-wins case, via `createRepoContextMock`.

# Migrate AutoFixAllGithub and its caller

## `core/lib/commands/AutoFixAllGithub.js`

- **Constructor** → `constructor(repoContext, { repoContextFactory, issueTaggerFactory, branchCleanup } = {})`.
  - Store `this._repoContext = repoContext`.
  - Keep `repoContextFactory` (`new RepoContextFactory()`), `issueTaggerFactory`
    (the same `(bundle) => new IssueTagger({ context: bundle.context, issueClient: bundle.issueClient })`
    default), and `branchCleanup` (`new BranchCleanup()`) injectable.
  - Update the constructor JSDoc to add the `repoContext` param and note that the
    factory is now fed via `buildFromContext`.
- **`_prOperations()`** — drop the `repoPath` param;
  `return new PrOperations(this._repoContextFactory.buildFromContext(this._repoContext));`
  (mirrors `AutoFixAllWaitCi#_prOperations`).
- **`_issueTagger()`** — drop the `repoPath` param;
  `return this._issueTaggerFactory(this._repoContextFactory.buildFromContext(this._repoContext));`
- **`_tagMutationService()`** — drop the `repoPath` param;
  `const bundle = this._repoContextFactory.buildFromContext(this._repoContext);`
  then the existing `new TagMutationService({ issueTagger: this._issueTaggerFactory(bundle), context: bundle.context })`.
- Update the three builders' JSDoc (drop `@param repoPath`, adjust prose that says
  "per call `repoPath`").
- **Every public method** loses its leading `repoPath` parameter and derives it
  from the context where still needed:
  - `prNumber()`, `prState()`, `prMerge(modelEmail)` — presence guard becomes
    `if (!this._repoContext.repoPath)`, keep the same `USAGE` strings; body calls
    `this._prOperations().<method>(...)`.
  - `hasShipitLabel(id)` — guard `if (!this._repoContext.repoPath || !id)`; body
    `this._issueTagger().hasLabel(id, 'shipit')`.
  - `addTag(id, tag)` / `removeTag(id, tag)` — guard
    `if (!this._repoContext.repoPath || !id || !tag)`; body
    `this._tagMutationService().addTag(id, tag)` / `.removeTag(id, tag)`.
  - `cleanupBranch(id)` — `return this._branchCleanup.cleanupBranch(this._repoContext.repoPath, id);`
    (`BranchCleanup` stays raw-path based).
  - Update each method's JSDoc (`@param repoPath` removed).
- Update the class-level JSDoc: the "Kept … since `AutoFixAllWaitCiAndMerge.js`
  instantiates it directly" note stays true, but it now instantiates it *with a
  `repoContext`*.

## `core/lib/commands/AutoFixAllWaitCiAndMerge.js`

- Constructor default → `github = new AutoFixAllGithub(repoContext)` (the
  `repoContext` positional param is in scope in the default expression).
- In `run(modelEmail)`: replace
  `const mergeOutput = await this._github.prMerge(repoPath, modelEmail);`
  with `const mergeOutput = await this._github.prMerge(modelEmail);` and **delete**
  the preceding `// Interim asymmetry: ... until #312.` comment block.
- The local `const repoPath = this._repoContext.repoPath;` and its presence guard
  / `repoPathValidator.validate(repoPath)` stay as-is.
- Update the `github` param JSDoc if it references the positional-`repoPath` shape.

## `core/spec/lib/commands/AutoFixAllGithub_spec.js`

- **`newGithub` helper**: move `origin` / `githubToken` / `issueStateService` /
  `configChain` out of the `RepoContextFactory` and into a
  `new RepoContext({ repoPath: REPO_PATH, origin, githubToken, issueStateService, configChain })`;
  pass that as the first arg:
  `new AutoFixAllGithub(repoContext, { repoContextFactory: new RepoContextFactory({ execFileAsync, fetchFn, timeoutMs }), branchCleanup: new BranchCleanup({ execFileAsync }), ...rest })`.
  Add an optional `repoPath` override key so the "missing repoPath" tests can
  build the context with `repoPath: ''`. Mirror `AutoFixAllWaitCi_spec.js`'s
  `newWaitCi`.
- Drop the leading `REPO_PATH` argument from every
  `github.prNumber(REPO_PATH)` / `prState` / `prMerge` / `addTag` / `removeTag` /
  `cleanupBranch` / `hasShipitLabel` call (and matching
  `toHaveBeenCalledWith` assertions).
- The "missing repoPath" tests (`github.prNumber()` etc.) now build the instance
  with an empty-`repoPath` context and still expect the `Usage: github.sh …`
  rejection.
- **Rewrite** the test `'builds a fresh, context-bound bundle per call via
  RepoContextFactory, forwarding the shared execFileAsync/fetchFn'`: its premise
  is per-call varying `repoPath` (`github.prState('/fake/repo/one')` then
  `github.prState('/fake/repo/two')` on one instance). After the migration
  `repoPath` is fixed at construction. Recast it to build one instance whose
  context has a known `repoPath`, call `prState()` twice, and assert both calls
  route through the injected `execFileAsync` (`options.cwd === <that repoPath>`)
  and `fetchFn` via `buildFromContext` — i.e. it still proves the shared
  low-level fns are used, just not per-call-varying paths.
- The `'shares the same origin/githubToken instances …'` test keeps its intent;
  update it for the context-fed origin/token and the dropped `REPO_PATH` args.

## `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js`

- `stubDeps().github` is a stub (`{ prMerge: <spy> }`) — no construction change
  for `github`, but the first constructor arg (currently `{ repoPath: REPO_PATH }`
  / `{ repoPath: '' }`) is fine as-is (a plain object with `.repoPath` still
  satisfies the code), or switch to `new RepoContext({ repoPath: REPO_PATH })`
  to match sibling specs — either works; prefer the `RepoContext` form for
  consistency.
- Update the `expect(deps.github.prMerge).toHaveBeenCalledWith(REPO_PATH, MODEL_EMAIL)`
  and `toHaveBeenCalledWith(REPO_PATH, undefined)` assertions to
  `toHaveBeenCalledWith(MODEL_EMAIL)` / `toHaveBeenCalledWith(undefined)`.

## Parity suites (verify, no edits expected)

Run `spec/bin/autoFixAllGithubParity/`, `spec/bin/autoFixAllWaitCiAndMergeParity_spec.js`,
`spec/bin/spawnIssueParity_spec.js`, `spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`
— the CLI arg contract is unchanged (Dispatcher strips `args[0]`), so these
should stay green. If any fails, the flag/constructor wiring is inconsistent.

## Files to Change

- `core/lib/commands/AutoFixAllGithub.js` — constructor, `_prOperations` /
  `_issueTagger` / `_tagMutationService` via `buildFromContext`, drop `repoPath`
  from all seven methods, `cleanupBranch` reads `this._repoContext.repoPath`.
- `core/lib/commands/AutoFixAllWaitCiAndMerge.js` — `new AutoFixAllGithub(repoContext)`
  default, `prMerge(modelEmail)`, remove the interim-asymmetry comment.
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — `newGithub` rewire,
  drop `REPO_PATH` args, rewrite the per-call-bundle test.
- `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js` — `prMerge` call
  assertions.

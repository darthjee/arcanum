# Migrate AutoFixAllWaitCi

Depends on Step 1 (`RepoContextFactory.buildFromContext`). This command builds a
per-call `RepoContextFactory` bundle for `PrOperations`/`PrChecker` and reads
config through an injected `RepoConfig`. After migration it consumes the
injected `RepoContext`, keeps `RepoConfig` as a dep, and **gains** a
`RepoPath#validate` first step.

## What to do

- `core/lib/core/commands.js`: add `takesRepoContext: true` to the
  `auto-fix-all-wait-ci` entry.
- Constructor:
  ```js
  constructor(repoContext, {
    repoContextFactory = new RepoContextFactory({ timeoutMs: DEFAULT_TIMEOUT_MS }),
    repoConfig = new RepoConfig(),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep,
    repoPathValidator = new RepoPath()
  } = {})
  ```
  Store `this._repoContext = repoContext` and `this._repoPathValidator`; keep
  the rest as today. Add `import RepoPath from '../utils/file/RepoPath.js';`.
- `_prOperations(repoPath)` → `_prOperations()`:
  `return new PrOperations(this._repoContextFactory.buildFromContext(this._repoContext));`
- `_prChecker(repoPath)` → `_prChecker()`:
  `return new PrChecker({ prOperations: this._prOperations() });`
- `run(repoPath)` → `run()`:
  - `if (!this._repoContext.repoPath) throw new Error(USAGE);` — keep this
    **before** validate so the empty-path message stays exactly
    `Usage: wait_ci.sh <repo_path>` and no I/O happens (existing test:
    `execFileAsync` not called).
  - `await this._repoPathValidator.validate(this._repoContext.repoPath);` — new
    step; for a non-empty-but-invalid path this now throws `RepoPath`'s
    `Error: not a directory: ...` / `Error: not a git repository: ...` instead
    of proceeding. Deliberate (see issue's Expected Behavior).
  - `const ignoredPatterns = await this._repoConfig.getIgnoredCheckPatterns(this._repoContext.repoPath);`
  - `const prNumber = Number((await this._prOperations().prNumber()).trim());`
  - `const prChecker = this._prChecker();`
  - Poll loop unchanged.
- Because `buildFromContext` takes `origin`/`githubToken`/`configChain`/
  `issueStateService` from `this._repoContext`, the factory only needs
  `execFileAsync` / `fetchFn` / `timeoutMs` on this path — its default
  `new RepoContextFactory({ timeoutMs: DEFAULT_TIMEOUT_MS })` still works in
  production (real `RepoContext` from `Dispatcher` carries real collaborators).
- No stdout/exit-code change for the happy/failed/pending paths — parity spec
  untouched. (The added `validate` only changes behavior for a `repoPath` that
  is present but not a git dir, which the shell script also effectively rejects
  via `repo_path_enter`.)

## Tests

`core/spec/lib/commands/AutoFixAllWaitCi_spec.js` — rework the `newWaitCi`
helper:

- Build `repoContext = new RepoContext({ repoPath, origin, githubToken })` from
  the fakes the helper already constructs (`origin`/`githubToken`), and pass it
  as the first constructor arg.
- Keep `repoContextFactory: new RepoContextFactory({ execFileAsync, fetchFn,
  timeoutMs })` as a forwarded dep (origin/githubToken no longer needed on it
  for this path, but harmless to leave).
- Inject `repoPathValidator: { validate: jasmine.createSpy().and.resolveTo(undefined) }`
  by default so the real `RepoPath` doesn't `stat('/repo/path')`.
- `instance.run(REPO_PATH)` → `instance.run()` everywhere; the
  missing-`repoPath` test builds the context with `repoPath: ''` and asserts
  `run()` rejects with `Usage: wait_ci.sh <repo_path>` and `execFileAsync` not
  called.
- Add one test: given a non-empty `repoPath` and a `repoPathValidator` stub that
  rejects, `run()` rejects with that error and no `fetchFn`/`execFileAsync`
  call is made.
- The `getIgnoredCheckPatterns` / ignored-pattern / token-header / transient-
  error tests are unchanged apart from the `run()` signature.

## Files to Change

- `core/lib/core/commands.js` — flag on `auto-fix-all-wait-ci`.
- `core/lib/commands/AutoFixAllWaitCi.js` — import `RepoPath`; constructor;
  `_prOperations()` / `_prChecker()`; `run()`.
- `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` — `newWaitCi` builds a
  `RepoContext`; inject `repoPathValidator`; `run()` call sites; add the
  invalid-path test.

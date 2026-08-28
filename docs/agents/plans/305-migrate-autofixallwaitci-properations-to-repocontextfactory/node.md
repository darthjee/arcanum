# Node Plan: Migrate AutoFixAllWaitCi._prOperations to RepoContextFactory

Main plan: [plan.md](plan.md)

## Overview

`core/lib/context/RepoContextFactory.js` already exists (#304) and
`AutoFixAllGithub` was reworked in #306 to build every per-call
`RepoContext` bundle through an injected `RepoContextFactory` collaborator.
`AutoFixAllWaitCi` is the deferred other half: it still hand-assembles its
own `RepoContext` + `GitClient`/`GitBranch`/`Git`/`GitHubClient` inside
`_prOperations(repoPath)` (~13 lines near-identical to the ones
`AutoFixAllGithub` deleted). Replace that with
`new PrOperations(this._repoContextFactory.build(repoPath))` and give the
command the same constructor shape as `AutoFixAllGithub`.

## Context

Current `core/lib/commands/AutoFixAllWaitCi.js`:

- Constructor deps: `origin`, `githubToken`, `repoConfig`,
  `execFileAsync`, `fetchFn`, `timeoutMs`, `pollIntervalMs`, `sleepFn`.
- `_prOperations(repoPath)` builds `new RepoContext({ repoPath, origin,
  githubToken })` (no `issueStateService`/`configChain` — `RepoContext`
  defaults them), then `GitClient` → `GitBranch` → `Git`, plus
  `GitHubClient`, then returns `new PrOperations({ context, gitClient,
  gitBranch, git, githubClient })`.
- `_prChecker(repoPath)` returns `new PrChecker({ prOperations:
  this._prOperations(repoPath) })`.
- `run(repoPath)` uses `repoConfig.getIgnoredCheckPatterns`,
  `_prOperations(repoPath).prNumber()`, then polls `_prChecker(repoPath)`
  with `sleepFn`/`pollIntervalMs`.

`RepoContextFactory#build(repoPath)` returns
`{ context, gitClient, gitBranch, git, githubClient, issueClient }` — a
superset of what `PrOperations` reads; the extra `issueClient` key is
ignored, exactly as in `AutoFixAllGithub#_prOperations`. Its constructor
owns `origin`/`githubToken`/`issueStateService`/`configChain`/
`execFileAsync`/`fetchFn`/`timeoutMs`; `GitHubClient`'s own `timeoutMs`
default is `30000`, identical to `AutoFixAllWaitCi`'s current
`DEFAULT_TIMEOUT_MS`, so routing `timeoutMs` through the factory (or
letting it default) keeps the abort timeout unchanged.

`AutoFixAllGithub_spec.js`'s `newGithub(overrides)` helper is the pattern
to mirror: flat override keys (`origin`/`githubToken`/`execFileAsync`/
`fetchFn`/`timeoutMs`) are destructured and fed into
`new RepoContextFactory({...})`; any other key (e.g. `sleepFn`,
`repoConfig`, `pollIntervalMs`) is spread straight onto the command
constructor.

Consumers of `AutoFixAllWaitCi` are unaffected: `core/bin/arcanum`
(`auto-fix-all-wait-ci`) and `AutoFixAllWaitCiAndMerge` both construct it
zero-arg; `AutoFixAllWaitCiAndMerge_spec.js` injects a fake `waitCi`
stub; `core/spec/bin/autoFixAllWaitCiParity_spec.js` drives the real
CLI. Only `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` constructs it
with deps and needs updating.

## Implementation Steps

### Step 1 — Rewire `AutoFixAllWaitCi.js` onto `RepoContextFactory`

- Add `import RepoContextFactory from '../context/RepoContextFactory.js';`
  (alphabetical order: after `PrOperations`, before `RepoConfig`).
- Remove the imports that only existed to hand-build the context:
  `Git`, `GitBranch`, `GitClient`, `GitHubClient`, `Origin`,
  `GithubToken`. Keep `PrChecker`, `PrOperations`, `RepoConfig`, and the
  `node:child_process`/`node:util` imports (`execFile`/`promisify` still
  back `defaultExecFileAsync`). Keep `DEFAULT_TIMEOUT_MS`,
  `DEFAULT_POLL_INTERVAL_MS`, `USAGE`, `defaultSleep`.
- Reshape the constructor to:
  ```js
  constructor({
    repoContextFactory = new RepoContextFactory(),
    repoConfig = new RepoConfig(),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._repoContextFactory = repoContextFactory;
    this._repoConfig = repoConfig;
    this._pollIntervalMs = pollIntervalMs;
    this._sleep = sleepFn;
  }
  ```
  Drop the `_origin`/`_githubToken`/`_execFileAsync`/`_fetch`/`_timeoutMs`
  fields — the factory owns that wiring now. Update the constructor
  JSDoc to describe `repoContextFactory` (mirror `AutoFixAllGithub`'s
  wording) and drop the `origin`/`githubToken`/`execFileAsync`/`fetchFn`/
  `timeoutMs` param docs.
- Replace `_prOperations(repoPath)` body with:
  ```js
  return new PrOperations(this._repoContextFactory.build(repoPath));
  ```
  and update its JSDoc to match `AutoFixAllGithub#_prOperations` (note the
  ignored `issueClient` key, cheap zero-I/O per-call build).
- Leave `_prChecker(repoPath)` and `run(repoPath)` untouched (they still
  call `this._prOperations`/`this._prChecker`/`this._repoConfig`/
  `this._sleep`/`this._pollIntervalMs`).
- Update the class-level JSDoc block: it currently points at
  `AutoFixAllGithub#_prOperations`'s "hand-build a context" docstring —
  reword to say the per-call `PrOperations`/`PrChecker` pair is built off
  a `RepoContextFactory` bundle, keeping the "`repoPath` isn't known
  until `run()`" rationale.

### Step 2 — Update `AutoFixAllWaitCi_spec.js` to the new construction path

- Add `import RepoContextFactory from '../../../lib/context/RepoContextFactory.js';`.
- Replace `stubDeps` with a `newWaitCi(overrides = {})` helper modeled on
  `AutoFixAllGithub_spec.js`'s `newGithub`: destructure `origin`,
  `githubToken`, `execFileAsync`, `fetchFn`, `timeoutMs` (default
  `timeoutMs` small, e.g. `5`) with the existing default stub values,
  collect the rest, and return
  ```js
  new AutoFixAllWaitCi({
    repoContextFactory: new RepoContextFactory({
      origin, githubToken, execFileAsync, fetchFn, timeoutMs
    }),
    ...rest
  });
  ```
  `rest` carries `repoConfig`, `pollIntervalMs`, `sleepFn` straight
  through.
- Update each `it` block: tests that only need the instance call
  `newWaitCi({ ... })` directly. Tests that assert on a spy
  (`execFileAsync`, `fetchFn`, `sleepFn`, `repoConfig.getIgnoredCheckPatterns`)
  create the spy as a local `const`, pass it via the override, and assert
  on that local — same approach `AutoFixAllGithub_spec.js` uses.
  - "throws the usage message when repo_path is missing": keep a local
    `execFileAsync` spy passed via override so the existing
    `not.toHaveBeenCalled()` assertion still has something to check (or
    drop that assertion and keep only the rejection expectation, matching
    `AutoFixAllGithub_spec.js`'s usage tests — either is fine).
  - "sends the resolved GitHub token as a bearer header on every REST
    call": keep a local `fetchFn` from `fakeFetch({...})` and assert on
    its `calls.allArgs()`.
- Keep `fakeExecFileAsync`, `fakeFetch`, and every scenario's
  fetch/exec/poll wiring exactly as-is — only the assembly of the
  command instance changes, not the fakes or the behavioral assertions.

## CI Checks

- `core/`: `yarn test` (CI job: `test` in `.circleci/config.yml`) — must
  stay green, in particular
  `core/spec/lib/commands/AutoFixAllWaitCi_spec.js`,
  `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js`, and the
  byte-for-byte parity spec
  `core/spec/bin/autoFixAllWaitCiParity_spec.js`.
- `core/`: `yarn lint` (CI job: `checks`) — import list is alphabetized
  and unused imports are an error, so the removed imports must be fully
  gone.

## Notes

- No behavior change: `RepoContextFactory` forwarding `issueStateService`/
  `configChain` as `undefined` produces the same `RepoContext` the
  hand-built path did (it defaulted them too), and `timeoutMs` resolves
  to the same `30000` either via the factory or `GitHubClient`'s own
  default.
- Out of scope: any shared base class / mixin between `AutoFixAllGithub`
  and `AutoFixAllWaitCi`; any change to `AutoFixAllWaitCiAndMerge` beyond
  what zero-arg `new AutoFixAllWaitCi()` already covers.

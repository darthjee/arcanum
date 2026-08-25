# Issue: reduce size of PrOperations

## Description

`core/lib/utils/github/PrOperations.js` is a God Object with 5 distinct responsibilities, mixing git CLI operations, GitHub REST lookups, merge-body/co-authors logic, PR mutations, and PR state derivation into one 509-line class. This issue extracts 4 new classes (`RepoContext`, `GitClient`, `GitHubClient`, `MergeBodyResolver`) and refactors `PrOperations` into a thin facade; `AutoFixAllGithub` is adjusted to create `RepoContext` per-call.

## Problem

`PrOperations` (509 lines) accumulates:

1. **Git CLI operations** — `_currentBranch` via `execFile`
2. **GitHub REST lookups** — `_findPr`, `_fetchPrCommits`, `_resolveMergerLogin`
3. **Merge body & co-authors logic** — `mergeBodyMode`, `_resolveMergeBody`, `_coauthorsBody`, `_uniqueByEmail`, `_modelCoauthorOmitted`, `_removeCoauthorsList`
4. **PR mutations** — `_mergePr`, `_deleteBranchRef`
5. **PR state derivation** — `_prStateLabel` (pure function)

## Expected Behavior

No externally visible behavior changes. `AutoFixAllGithub`'s public API (`prNumber`, `prState`, `prMerge`, `cleanupBranch`, `hasShipitLabel`, `addTag`, `removeTag`) is unchanged, and `AutoFixAllWaitCiAndMerge` (which instantiates `AutoFixAllGithub` directly to call `prMerge`) needs no modification. The CLI router continues calling `new AutoFixAllGithub().prNumber('/repo/path')` exactly as before.

## Solution

### Design Decisions

| Decision | Choice |
| --- | --- |
| Scope | All in issue #292 |
| Extraction order | RepoContext → GitClient → GitHubClient → MergeBodyResolver → PrOperations → AutoFixAllGithub |
| RepoContext | Per-call, created by `AutoFixAllGithub`, received in **constructor** of `PrOperations` and `MergeBodyResolver` |
| GitClient | Singleton, `repoPath` comes as method param |
| GitHubClient | Singleton, `token` comes as method param |
| PrOperations | Per-call, public methods have no params (except `modelEmail` in `prMerge`) |
| Tests | Unit tests for each new class + parity for PrOperations + spec helper for RepoContext |

### Alternatives Considered

- **Bare `Context`** (original draft name) — rejected: too generic/content-free, and no other class in `core/lib` uses a bare "Context" abstraction; the name gave no hint of what it actually holds.
- **`LocalContext`** — rejected: "local" doesn't add distinguishing information, since every class in `core/lib` already operates on a local repo checkout (`repoPath` is ubiquitous); "Context" remained the vague part.
- **`RepoSession`** — considered: ties the name to the per-call lifecycle explicitly. Not chosen, but `RepoContext` was preferred for reading naturally alongside `resolveWithRef()`/`getToken()`/`getIssueState()`/`readConfig()`.
- **Dropping the shared wrapper entirely** (status quo: `PrOperations`/`MergeBodyResolver` each take `origin`/`githubToken`/`issueState`/`configChain` as individual constructor params, matching every other class in `core/lib` today) — not chosen: would mean each of `PrOperations`/`MergeBodyResolver` re-declares the same 4-param cluster, and the eventual value from centralizing "resolved per-call facts about this repo" outweighs the extra abstraction for this refactor.
- **`RepoContext`** (chosen) — scopes the "per-call resolved facts" idea to the repo it's about, without the bare-"Context" genericness or the redundant "local" qualifier.

### Architecture

#### File structure

```
core/lib/
├── context/
│   └── RepoContext.js                      ← NEW
├── utils/git/
│   ├── Origin.js                           ← exists
│   └── GitClient.js                        ← NEW
├── utils/github/
│   ├── GithubToken.js                      ← exists
│   ├── GitHubClient.js                     ← NEW
│   ├── MergeBodyResolver.js                ← NEW
│   └── PrOperations.js                     ← REFACTORED (facade)
├── commands/
│   └── AutoFixAllGithub.js                 ← ADJUSTED (creates RepoContext per-call)

core/spec/
├── lib/context/
│   └── RepoContext_spec.js                 ← NEW
├── lib/utils/git/
│   └── GitClient_spec.js                   ← NEW
├── lib/utils/github/
│   ├── GitHubClient_spec.js                ← NEW
│   ├── MergeBodyResolver_spec.js           ← NEW
│   └── PrOperations_spec.js               ← NEW (parity)
└── support/factories/
    └── repoContextFactory.js               ← NEW (helper)
```

#### Call flow

```
CLI: core/bin/arcanum auto-fix-all-github-pr-number /path/to/repo
  │
  ▼ (router unchanged — new AutoFixAllGithub().prNumber('/path/to/repo'))
  │
AutoFixAllGithub.prNumber(repoPath):
  context = new RepoContext({ repoPath, origin, githubToken, issueState, configChain })
  prOps = new PrOperations({ context, gitClient, githubClient })
  return prOps.prNumber()
  │
  ▼
PrOperations.prNumber():
  branch    = await this._git.currentBranch(context.repoPath)
  { repo, repoRef } = await context.resolveWithRef()
  token     = await context.getToken()
  pull      = await this._github.getPr(repo, branch, token, repoRef)
  cached    = await context.getIssueState(id, 'pr_id')   // if branch = issue-N
  return `${pull.number}
`
```

### New Classes

#### 1. RepoContext (`core/lib/context/RepoContext.js`)

Centralizes resolved dependencies + `repoPath`. Created **per-call** by `AutoFixAllGithub`.

```js
class RepoContext {
  constructor({
    repoPath,
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueState = new IssueState(),
    configChain = new ConfigChain()
  } = {}) {
    this.repoPath = repoPath;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueState = issueState;
    this._configChain = configChain;
  }

  async resolveWithRef()       { return this._origin.resolveWithRef(this.repoPath); }
  async resolve()              { return this._origin.resolve(this.repoPath); }
  async getToken()             { return this._githubToken.get(this.repoPath); }
  async getIssueState(id, key) { return this._issueState.get(this.repoPath, id, key); }
  async readConfig(scope, key) { return this._configChain.read(this.repoPath, scope, key); }
}
```

#### 2. GitClient (`core/lib/utils/git/GitClient.js`)

Encapsulates all git CLI interaction via `execFile`. Does NOT receive `RepoContext` — `repoPath` comes as method param. Keeps the class reusable outside PR flows.

```js
class GitClient {
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  async currentBranch(repoPath) {
    const { stdout } = await this._execFileAsync('git',
      ['branch', '--show-current'], { cwd: repoPath });
    return stdout.trim();
  }
}
```

#### 3. GitHubClient (`core/lib/utils/github/GitHubClient.js`)

Encapsulates all GitHub REST API communication — auth, timeout, error handling. `token` comes as method param, NOT from constructor. Does NOT know about `RepoContext`.

```js
class GitHubClient {
  constructor({ fetchFn = fetch, timeoutMs = 30000 } = {}) { ... }

  async getPr(repo, branch, token, repoRef)        // GET /repos/{repo}/pulls
  async getPrCommits(repo, number, token)          // GET /repos/{repo}/pulls/{n}/commits
  async mergePr(repo, number, token, payload)     // PUT /repos/{repo}/pulls/{n}/merge
  async deleteBranch(repo, branch, token)          // DELETE /repos/{repo}/git/refs/heads/{branch}
  async getCurrentUser(token)                      // GET /user
}
```

Each method encapsulates: URL construction → headers (Authorization: Bearer) → AbortSignal.timeout → check response.ok → parse JSON.

#### 4. MergeBodyResolver (`core/lib/utils/github/MergeBodyResolver.js`)

All merge body mode + coauthors logic. Receives `RepoContext` (for config) and `GitHubClient` (for commit fetch + merger login) in the **constructor**.

```js
class MergeBodyResolver {
  constructor({ context, githubClient } = {}) { ... }

  async resolveMode()                                // context.readConfig('git', 'merge_body_mode')
  async buildBody(repo, number, token, modelEmail)   // orchestrates empty/full/coauthors
  async _coauthorsBody(repo, number, token, modelEmail)
  _uniqueByEmail(authors)                            // pure function — dedup + sort
  async _modelCoauthorOmitted()                     // context.readConfig('git', 'omit_model_coauthor')
  async _removeCoauthorsList()                       // context.readConfig('git', 'remove_coauthors')
}
```

#### 5. PrOperations — refactored facade (`core/lib/utils/github/PrOperations.js`)

Constructor receives `RepoContext` + `GitClient` + `GitHubClient`. Public methods have no params (except `modelEmail`).

```js
class PrOperations {
  constructor({ context, gitClient = new GitClient(),
                githubClient = new GitHubClient() }) { ... }

  async prNumber()           // git.currentBranch + context.getIssueState + github.getPr
  async prState()            // git.currentBranch + github.getPr + _prStateLabel
  async prMerge(modelEmail)  // git.currentBranch + github.getPr + MergeBodyResolver + github.mergePr + github.deleteBranch
  _prStateLabel(pull)        // pure function — unchanged
}
```

#### 6. AutoFixAllGithub — adjusted (`core/lib/commands/AutoFixAllGithub.js`)

Creates `RepoContext` per-call, instantiates `PrOperations` per-call with `RepoContext` in constructor. Public API unchanged — router continues doing `new AutoFixAllGithub().prNumber('/repo/path')`.

```js
class AutoFixAllGithub {
  constructor({
    origin = new Origin(), githubToken = new GithubToken(),
    fetchFn = fetch, timeoutMs, issueState, configChain, execFileAsync,
    gitClient = new GitClient({ execFileAsync }),
    githubClient = new GitHubClient({ fetchFn, timeoutMs }),
    // issueTagger, branchCleanup...
  } = {}) {
    this._origin = origin; this._githubToken = githubToken;
    this._issueState = issueState; this._configChain = configChain;
    this._gitClient = gitClient; this._githubClient = githubClient;
  }

  async prNumber(repoPath) {
    const context = new RepoContext({ repoPath, origin: this._origin,
      githubToken: this._githubToken, issueState: this._issueState,
      configChain: this._configChain });
    return new PrOperations({ context, gitClient: this._gitClient,
      githubClient: this._githubClient }).prNumber();
  }

  async prState(repoPath)  { /* same pattern */ }
  async prMerge(repoPath, modelEmail) { /* same pattern + modelEmail */ }
}
```

### Test Strategy

| Class | Spec file | Approach |
| --- | --- | --- |
| RepoContext | `core/spec/lib/context/RepoContext_spec.js` | Mock origin/githubToken/issueState/configChain — verify delegation |
| GitClient | `core/spec/lib/utils/git/GitClient_spec.js` | Mock `execFileAsync` — verify args and return |
| GitHubClient | `core/spec/lib/utils/github/GitHubClient_spec.js` | Mock `fetchFn` — verify URL, headers, payload, error handling per method |
| MergeBodyResolver | `core/spec/lib/utils/github/MergeBodyResolver_spec.js` | Mock `RepoContext` (config) + `GitHubClient` (commits) — test dedup, filter, formatting |
| PrOperations | `core/spec/lib/utils/github/PrOperations_spec.js` | Mock all clients — verify orchestration (parity with previous behavior) |

#### Spec helper (`core/spec/support/factories/repoContextFactory.js`)

```js
export function createRepoContextMock({ repoPath = '/fake/repo', ...overrides } = {}) {
  const origin = { resolveWithRef: jasmine.createSpy(), resolve: jasmine.createSpy(), ...overrides.origin };
  const githubToken = { get: jasmine.createSpy(), ...overrides.githubToken };
  const issueState = { get: jasmine.createSpy(), ...overrides.issueState };
  const configChain = { read: jasmine.createSpy(), ...overrides.configChain };
  return new RepoContext({ repoPath, origin, githubToken, issueState, configChain });
}
```

Used in `PrOperations_spec.js` and `MergeBodyResolver_spec.js` to instantiate `RepoContext` with spies without repeating boilerplate.

### Implementation Order

Each step is a green commit — new files are not imported by anything until Step 6.

| Step | What | Files |
| --- | --- | --- |
| 1 | Create `RepoContext` + spec + helper | `RepoContext.js`, `RepoContext_spec.js`, `repoContextFactory.js` |
| 2 | Create `GitClient` + spec | `GitClient.js`, `GitClient_spec.js` |
| 3 | Create `GitHubClient` + spec | `GitHubClient.js`, `GitHubClient_spec.js` |
| 4 | Create `MergeBodyResolver` + spec | `MergeBodyResolver.js`, `MergeBodyResolver_spec.js` |
| 5 | Refactor `PrOperations` + parity spec | `PrOperations.js`, `PrOperations_spec.js` |
| 6 | Adjust `AutoFixAllGithub` | `AutoFixAllGithub.js` |
| 7 | Validate `AutoFixAllWaitCiAndMerge` | no change expected |

Steps 1–4 are **additive** — they don't touch existing code, only create new files. Step 5 is the refactoring that moves logic. Step 6 wires everything together. The repo stays green at every intermediate commit because new files are not imported by anything until Step 6.

### Notes

- `AutoFixAllWaitCiAndMerge` instantiates `AutoFixAllGithub` directly to call `prMerge` — since the public API of `AutoFixAllGithub` is unchanged, no modification is expected.
- No spec file exists for `PrOperations` today — parity tests must be created from scratch by characterizing current behavior.
- Zero runtime dependencies — all new classes use only Node built-in APIs (`fetch`, `execFile`, `promisify`).

## Benefits

- Each class has a single, testable responsibility instead of one 509-line God Object.
- `GitClient`/`GitHubClient` become reusable outside PR flows since neither is coupled to `RepoContext`.
- `PrOperations` (currently untested) gets real coverage via parity tests, plus focused unit specs for each extracted class.
- Matches this repo's existing dependency-injection conventions in `core/lib` rather than introducing a divergent pattern.

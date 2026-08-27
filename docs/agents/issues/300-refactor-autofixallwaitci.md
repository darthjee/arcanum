
## Problem

`AutoFixAllWaitCi` (`core/lib/commands/AutoFixAllWaitCi.js`, 303 lines) accumulates four distinct responsibilities that violate the project's layered architecture (`commands/` → `services/` → `utils/`, as defined in `docs/agents/architecture/script-engine.md`):

1. **CLI entrypoint orchestration** — the `run()` method resolves repo, token, branch, PR number, and runs the poll loop.
2. **GitHub REST calls** — `_fetchHeadSha` and `_fetchCheckRuns` make raw `fetch()` calls to the GitHub API, duplicating the pattern already centralized in `GitHubClient.js`.
3. **PR number resolution** — `_resolvePrNumber` reimplements what `PrOperations#prNumber()` already does (resolving the current branch's PR).
4. **Decision tree + resilience** — `_pollOnce` contains the passed/failed/pending logic, `_safeFetch` wraps fetch in try/catch, and `_isIgnored` does regex filtering — all of which belong in lower layers.

This mirrors the exact problem that `PrOperations` had before plan #292 refactored it into a thin orchestration class delegating to `GitHubClient` and `GitClient`.

## Solution

### Methods extraction

Extract the internal methods to their appropriate layers following the precedent set by `PrOperations` (plan #292) and the dependency direction defined in the Script Engine architecture.

#### `PrChecker` service (new — `core/lib/services/PrChecker.js`)

| Method moved | From | Responsibility |
| --- | --- | --- |
| `_pollOnce` | `AutoFixAllWaitCi` | Decision tree: given check-runs + ignored patterns, returns `passed`, `failed`, or `null` (pending) |
| `_isIgnored` | `AutoFixAllWaitCi` | Regex match against ignored check-run patterns (private helper within `PrChecker`) |

`PrChecker` receives `GitHubClient` (and optionally `PrOperations`) injected via constructor, following the same DI pattern as `IssueStateService` and `PrOperations`.

#### Alternatives considered

- **Extend `PrOperations` directly instead of a new `PrChecker` service** — rejected: `PrOperations` (`utils/github/`) is a thin protocol-facade layer; adding decision logic (`pollOnce`'s passed/failed/pending tree, `isIgnored`'s regex filtering) there would reintroduce the exact `services/`-vs-`utils/` layering violation that #296/#297 (`IssueStateService`) already fixed elsewhere. A dedicated `services/PrChecker.js` keeps decision logic in the `services/` layer and `PrOperations` limited to REST orchestration.
- **Have `PrChecker` own the entire retry loop** (interval/sleep), not just one poll attempt — rejected: keeps `PrChecker` trivially testable (single call in, single decision out) and keeps `AutoFixAllWaitCi.run()`'s orchestration role (the `for (;;)` loop + sleep) visible at the command layer, matching the target shape already sketched below.

#### `GitHubClient` extensions (`core/lib/utils/github/GitHubClient.js`)

| Method added | From | Responsibility |
| --- | --- | --- |
| `getPrHeadSha(prNumber)` | `_fetchHeadSha` | `GET /repos/{repo}/pulls/{prNumber}` → returns the PR's head SHA |
| `getCheckRuns(sha)` | `_fetchCheckRuns` | `GET /repos/{repo}/commits/{sha}/check-runs` → returns check-runs array |

Both methods follow the existing `getPr(branch)` / `getPrCommits(number)` pattern exactly: `repo`/`token` resolved internally via `this._context` (never taken as parameters — `GitHubClient` is `RepoContext`-bound at construction), `fetch` with `Authorization` header, `AbortSignal.timeout`, structured error handling. (Earlier drafts of this issue showed `getPrHeadSha(repo, prNumber, token)`/`getCheckRuns(repo, sha, token)` — that predates the `RepoContext`-bound refactor `GitHubClient` went through in #292/#294/#295; corrected here.)

#### `PrOperations` extensions (`core/lib/utils/github/PrOperations.js`)

| Method added | Responsibility |
| --- | --- |
| `headSha(prNumber)` | Orchestrates `GitHubClient.getPrHeadSha()` — thin delegation, same as `prNumber()` delegates to `GitHubClient.getPr()` |
| `checkRuns(sha)` | Orchestrates `GitHubClient.getCheckRuns()` — thin delegation |

#### `_safeFetch` → `core/lib/utils/safe/SafeFetcher.js` (new)

`GitHubClient`'s new methods throw structured errors on failure (matching `getPr()`/`getPrCommits()`) rather than swallowing them, so `_safeFetch`'s "any error → null, so the poll loop retries" behavior still needs a home. No other current call site has the same swallow-and-retry shape (checked — the codebase's other `catch { return null }` sites are unrelated file/config read-or-null helpers, not REST resilience), so this is deliberately speculative reuse rather than an existing second caller.

| Current | Proposed |
| --- | --- |
| `_safeFetch` in `AutoFixAllWaitCi` | Extract to a generic `SafeFetcher` utility (`run(fn)`: await `fn()`, catch any error, return `null`). `PrChecker` takes a `safeFetcher` collaborator (default `new SafeFetcher()`) and wraps its `prOperations.headSha(prNumber)`/`prOperations.checkRuns(sha)` calls in it, preserving `pollOnce`'s exact current resilience semantics. |

#### `_resolvePrNumber` — remove (duplicate of existing)

| Current | Proposed |
| --- | --- |
| `_resolvePrNumber` in `AutoFixAllWaitCi` | **Remove** — use `PrOperations#prNumber()` which already resolves the current branch's PR number. The command currently reimplements this with a direct `fetch` to `GET /repos/{repo}/pulls`. |

**Edge case considered:** unlike the current always-live lookup, `PrOperations#prNumber()` trusts a cached `pr_id` from `.claude/state/issue-<id>.json` when present, on an `issue-<id>` branch. Considered whether a stale cache could cause `AutoFixAllWaitCi`'s poll loop to run indefinitely against the wrong PR — not a real risk: the PR number is resolved exactly once per invocation and stays fixed for the duration of that run, same as the current `_resolvePrNumber` behavior; the only difference is whether that single resolution is cached or live, which doesn't change the loop's semantics. No cache-bypass needed — use `prNumber()` as-is, matching `AutoFixAllGithub`'s existing usage.

#### `_currentBranch` — remove (duplicate of existing)

| Current | Proposed |
| --- | --- |
| `_currentBranch` in `AutoFixAllWaitCi` | **Remove** — use `GitClient#currentBranch()` (already used by `PrOperations`). |

### Resulting `AutoFixAllWaitCi` (target shape)

`PrOperations`/`GitHubClient` are `RepoContext`-bound, and `repoPath` isn't known until `run(repoPath)` is called — so, exactly like `AutoFixAllGithub.js`'s `_prOperations(repoPath)` (see its own docstring: *"those two are no longer constructor-level shared singletons, since a `GitClient`/`GitHubClient` built without a `context` can't resolve `repoPath`/`token`/`repo`/`repoRef` at all"*), `prChecker`/`prOperations` cannot be constructor-injected as pre-built singletons. The constructor keeps the *shared* low-level collaborators; a private `_prChecker(repoPath)` builds the per-call, context-bound chain:

```js
class AutoFixAllWaitCi {
  constructor({
    origin, githubToken, repoConfig, fetchFn, timeoutMs, execFileAsync, pollIntervalMs, sleepFn
  } = {}) { ... }

  async run(repoPath) {
    // 1. Resolve repo, token via origin/githubToken
    // 2. Get PR number via this._prOperations(repoPath).prNumber()
    // 3. Poll loop: this._prChecker(repoPath).pollOnce(prNumber, ignoredPatterns)
    //    → returns 'passed
', 'failed
...', or null (sleep + retry, waiting pollIntervalMs via sleepFn)
  }

  _prOperations(repoPath) {
    // mirrors AutoFixAllGithub#_prOperations(repoPath): builds a RepoContext,
    // then context-bound GitClient/GitHubClient, then PrOperations from them
  }

  _prChecker(repoPath) {
    // wraps this._prOperations(repoPath) (and/or its githubClient) into a PrChecker
  }
}
```

`pollIntervalMs` stays on `AutoFixAllWaitCi`'s own constructor (default unchanged) — the retry loop stays at the command layer (see "Alternatives considered" above), so its interval option stays there too. `execFileAsync`/`fetchFn`/`timeoutMs` also stay on the constructor as *shared* low-level collaborators (matching `AutoFixAllGithub`'s own constructor shape) — they're forwarded into each call's fresh `_prOperations(repoPath)`/`_prChecker(repoPath)` build, not replaced by pre-built instances.

### Testing

- `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` keeps testing at the same level it does today — stubbing `fetchFn`/`execFileAsync` and asserting on the resulting REST calls/stdout/exit code — mirroring `AutoFixAllGithub_spec.js`'s own convention (it never mocks `PrOperations` directly either). Assertions and mock shapes should need little to no change; `pollIntervalMs`/`sleepFn` stubs are entirely unaffected.
- New unit tests for:
  - `PrChecker` — decision tree (all passed, some failed, still pending, empty check-runs, ignored patterns filtering).
  - `GitHubClient.getPrHeadSha()` and `GitHubClient.getCheckRuns()` — success, not-found, malformed response.
  - `PrOperations.headSha()` and `PrOperations.checkRuns()` — delegation verification.
- Parity test (shell vs. native) must remain green — the command's stdout and exit code must not change.

## Affected files

| File | Action |
| --- | --- |
| `core/lib/commands/AutoFixAllWaitCi.js` | Slim down to entrypoint orchestration |
| `core/lib/services/PrChecker.js` | **New** — poll-once decision tree + ignored filtering |
| `core/lib/utils/github/GitHubClient.js` | Add `getPrHeadSha()`, `getCheckRuns()` |
| `core/lib/utils/github/PrOperations.js` | Add `headSha()`, `checkRuns()` |
| `core/lib/utils/safe/SafeFetcher.js` | **New** — generic swallow-and-retry `run(fn)` wrapper, replacing `_safeFetch` |
| `core/spec/lib/services/PrChecker_spec.js` | **New** — unit tests |
| `core/spec/lib/utils/safe/SafeFetcher_spec.js` | **New** — unit tests |
| `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` | Update mocks for new dependencies |

## Scope

**In scope:** `AutoFixAllWaitCi.js`, the new `PrChecker` service, the `GitHubClient`/`PrOperations` PR-check-run additions, and their specs — as detailed in Solution above.

**Explicitly out of scope:**

- The shell counterpart (`wait_ci_shell.sh`) — behavior/stdout/exit-code parity is preserved, not migrated further.
- Any other existing `GitHubClient` methods (`getPr`, `getPrCommits`, `mergePr`, `deleteBranch`, `getCurrentUser`) — untouched besides the two additions.
- Issue-domain raw-`fetch` duplication in `utils/issue/IssueTagger.js`, `commands/GithubIssue.js`, and `commands/AutoFixAllReplyComment.js` — same category of violation (fetch calls bypassing a centralized client) but a different domain (issue lifecycle, not PR lifecycle) and a larger, unrelated set of constructor changes. Already handled separately in #301 (merged via #302), matching this repo's recent one-class-per-PR refactor pattern (#298, #296, #294, #292, #289) — not folded in here.

## References

- See also #301 (merged, PR #302) — the same underlying violation, already fixed for the issue-domain fetch calls; this issue applies the equivalent fix to the PR-domain ones. Independent from this issue, not a sub-issue of it.
- Architecture: `docs/agents/architecture/script-engine.md` — dependency direction (`commands/` → `services/` → `utils/`)

# Issue: Extract IssueClient from IssueTagger/GithubIssue/AutoFixAllReplyComment

## Problem

Three unrelated classes duplicate the same raw-`fetch`-to-`api.github.com` pattern for issue-domain (not PR-domain) REST calls, each with its own `origin`/`githubToken`/`fetchFn`/`timeoutMs` constructor and manual `repo`/`token` threading through method params:

- `core/lib/utils/issue/IssueTagger.js` — `fetchLabels`, `addLabel`, `removeLabel` (issue label mutation)
- `core/lib/commands/GithubIssue.js` — `fetch`/`create` (issue fetch/create)
- `core/lib/commands/AutoFixAllReplyComment.js` — `_postComment` (PR/issue comment posting)

This is the same category of violation that #300 addresses for the PR-domain equivalent (`AutoFixAllWaitCi`'s raw fetches), and the same one `GitHubClient`/`PrOperations` already solved for PR lifecycle calls via plan #292/#294/#295 — but none of these three classes have been migrated to that `RepoContext`-bound DI pattern.

## Solution

Introduce `IssueClient` (`core/lib/utils/github/IssueClient.js`), sibling to `GitHubClient`, `RepoContext`-bound (`repo`/`repoRef`/`token` resolved internally via `this._context`, not passed as method params):

| Method | Replaces | Responsibility |
| --- | --- | --- |
| `getIssue(id)` | `IssueTagger#fetchLabels`, `GithubIssue#fetch` (partial) | `GET /repos/{repo}/issues/{id}` |
| `addLabel(id, label)` | `IssueTagger#addLabel` | `POST /repos/{repo}/issues/{id}/labels` |
| `removeLabel(id, label)` | `IssueTagger#removeLabel` | `DELETE /repos/{repo}/issues/{id}/labels/{label}` |
| `createIssue(title, body)` | `GithubIssue#create` | `POST /repos/{repo}/issues` |
| `postComment(number, body)` | `AutoFixAllReplyComment#_postComment` | `POST /repos/{repo}/issues/{number}/comments` |

### Two different treatments, not one uniform conversion

`IssueTagger` and `AutoFixAllReplyComment` become fully `RepoContext`-bound, exactly matching `PrOperations`'s conversion to `GitHubClient` — constructor takes `context`/`issueClient`, no more `repo`/`token` method params. Their existing constructor-level callers need updating too:

- `IssueTagger` is default-constructed in **both** `AutoFixAllGithub.js` (`issueTagger = new IssueTagger({ origin, githubToken, fetchFn, timeoutMs })`) and `AutoFixAllQueue.js` — both switch to a per-call build (mirroring `AutoFixAllGithub`'s own `_prOperations(repoPath)` helper), since a context-bound `IssueTagger` can't be a constructor-level shared singleton once `repoPath` varies call to call.

`GithubIssue` does **not** get the same conversion — it keeps its current `fetch(repoPath, id)`/`create(repoPath, title, file)`/`info(repoPath)` public API untouched, and builds a per-call `IssueClient` internally (mirroring its own existing `_issueStateService(repoPath)` helper, which already does this exact trick for `IssueStateService`). Internally-raised concerns during discussion ruled out full conversion:

- `RepoContext` itself constructs a default `GithubIssue` (`context/RepoContext.js`, `this._githubIssue.create(this.repoPath, ...)`) — a context-bound `GithubIssue` would need `RepoContext` to hand itself in before it's finished constructing. Workaroundable (the same lazy-default-via-`this` trick already used for `_issueStateService`), but:
- `core/bin/arcanum`'s dispatch table maps `github-issue-create`/`github-issue-info` straight to `GithubIssue#create`/`#info`, and its generic dispatcher does `new ModuleClass()[entry.method](...args)` — a **zero-argument constructor**, with CLI args (repo path first) passed positionally into the method call. A `context`-requiring constructor is incompatible with that contract as-is.
- Decisively: **every other command in that same dispatch table already solves this identical problem the repoPath-per-call way** — `AutoFixAllGithub` (`auto-fix-all-github-pr-number` → `new AutoFixAllGithub().prNumber(repoPath)`) already needs a `RepoContext` internally for `PrOperations`/`GitHubClient`, and solves it by keeping `repoPath` as its public methods' first argument and building the context inside a private per-call helper (`_prOperations(repoPath)`), never at its own construction. `SpawnIssue`/`ResolveAndFetch` follow the same shape. Converting `GithubIssue` to constructor-level context injection would make it the *only* command in the dispatch table using that shape — the inconsistent one, not the consistent one.

So: `RepoContext.js`, `SpawnIssue.js`, `ResolveAndFetch.js`, and `bin/arcanum` need **zero** changes. Only `IssueTagger`, `AutoFixAllReplyComment`, and their two `IssueTagger`-constructing callers (`AutoFixAllGithub.js`, `AutoFixAllQueue.js`) get the context-bound treatment; `GithubIssue.js` gets an internal-only change (raw `fetch` calls replaced by a per-call `IssueClient`, same public API).

### Testing

- New unit tests for `IssueClient` (success, not-found, malformed response, per method).
- `IssueTagger_spec.js`/`AutoFixAllReplyComment_spec.js` — mocks change to reflect the new context-bound constructor shape (stubbing `issueClient`/`context` instead of raw `origin`/`githubToken`/`fetchFn`), matching how `PrOperations_spec.js` tests today. No change to externally-observed stdout/exit-code behavior.
- `GithubIssue_spec.js` — mocks stay at the same level they're at today (raw `fetchFn`), since the public API and constructor shape don't change; only the internal call path moves through `IssueClient`.
- `AutoFixAllGithub_spec.js`/`AutoFixAllQueue_spec.js` — update mocks for their `issueTagger` construction becoming per-call.

## Affected files

| File | Action |
| --- | --- |
| `core/lib/utils/github/IssueClient.js` | **New** |
| `core/lib/utils/issue/IssueTagger.js` | Convert to `RepoContext`-bound, delegate to `IssueClient` |
| `core/lib/commands/AutoFixAllReplyComment.js` | Convert to `RepoContext`-bound, delegate to `IssueClient` |
| `core/lib/commands/GithubIssue.js` | Internal only — build a per-call `IssueClient` (public API unchanged) |
| `core/lib/commands/AutoFixAllGithub.js` | Switch `issueTagger` from a constructor-level singleton to a per-call build |
| `core/lib/commands/AutoFixAllQueue.js` | Same `issueTagger` per-call-build change |
| `core/spec/utils/github/IssueClient_spec.js` | **New** |
| `core/spec/utils/issue/IssueTagger_spec.js` | Update mocks (context-bound shape) |
| `core/spec/commands/AutoFixAllReplyComment_spec.js` | Update mocks (context-bound shape) |
| `core/spec/commands/GithubIssue_spec.js` | Minimal/no changes (public API unchanged) |
| `core/spec/commands/AutoFixAllGithub_spec.js` | Update mocks for per-call `issueTagger` |
| `core/spec/commands/AutoFixAllQueue_spec.js` | Update mocks for per-call `issueTagger` |

## References

- See also #300 (`AutoFixAllWaitCi` PR-domain refactor) — same underlying violation (raw `fetch` duplication bypassing a centralized client), applied to the issue-domain instead of the PR-domain. Independent work, not a sub-issue of #300.
- Architecture: `docs/agents/architecture/script-engine.md` — dependency direction (`commands/` → `services/` → `utils/`)
- Precedent: `core/lib/utils/github/GitHubClient.js` / `core/lib/utils/github/PrOperations.js` (plans #292, #294, #295)

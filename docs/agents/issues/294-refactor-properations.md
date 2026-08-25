# Issue: Refactor PrOperations

## Description

`core/lib/utils/github/PrOperations.js` still threads infrastructure concerns (tokens, repo paths, repo refs) through its collaborators, even after #292 extracted `GitClient`/`GitHubClient`/`MergeBodyResolver`/`RepoContext` out of it. This issue pushes context resolution fully into each collaborator — binding `GitClient`/`GitHubClient`/`MergeBodyResolver` to a single `RepoContext` at construction instead of taking `token`/`repoPath`/`repo`/`repoRef` as method params — and introduces a new `Git`/`GitBranch` pair to eliminate the `branch.match(/^issue-(\d+)$/)` regex duplicated across `prNumber` and `prMerge`. `PrOperations` becomes a pure orchestrator of PR lifecycle steps.

## Problem

1. **Token/repo threading** — every `PrOperations` method resolves `token` via `context.getToken()` and `repo`/`repoRef` via `context.resolveWithRef()`, then passes them down to `GitClient`/`GitHubClient`/`MergeBodyResolver` on every call.
2. **Stateless singleton collaborators** — `GitClient`/`GitHubClient` take `repoPath`/`token` as method params (by design, per #292) so a single instance is reusable across repos; but `PrOperations` already only ever holds one `RepoContext` per lifecycle, so that reusability is unused value paid for with parameter noise on every call.
3. **Duplicated issue-branch regex** — `branch.match(/^issue-(\d+)$/)` appears independently in both `prNumber` and `prMerge`.
4. **`MergeBodyResolver` still needs `repo`/`token` passed in** — `PrOperations#_resolveMergeBody` resolves and forwards both on every `prMerge` call, instead of `MergeBodyResolver` resolving them itself from its own injected `context`.

## Expected Behavior

No externally visible behavior changes — this is a pure internal refactor:
- `core/bin/arcanum`'s CLI surface (`AutoFixAllGithub#prNumber`/`#prState`/`#prMerge`, taking `repoPath`/`modelEmail`) is unchanged.
- `github.sh`'s subcommand output and error-message wording (e.g. `no pull request found for the current branch on <repoRef>`) stay identical — `repoRef` still resolves to the same value, just internally within `GitHubClient` instead of being passed in.
- `AutoFixAllWaitCiAndMerge` (which instantiates `AutoFixAllGithub` directly to call `#prMerge`) needs no modification.
- `@arcanum/core` is `"private": true` (unpublished) — no external npm consumers exist to break.

## Solution

### Design Decisions

| Decision | Choice |
| --- | --- |
| Collaborator binding | `GitClient`/`GitHubClient`/`MergeBodyResolver` all receive `context` in their constructor and resolve `repoPath`/`token`/`repo`/`repoRef` internally — no more per-method infra params |
| `GitHubClient` repo/repoRef | Resolved internally via `context.resolveWithRef()`, same as `MergeBodyResolver` already does for `repo`/`token` — method signatures drop `repo`/`repoRef` entirely, not just `token` |
| `GitHubClient` instance lifetime | Becomes per-repo (one `context` = one client) — acceptable since `PrOperations` already holds one `context` per lifecycle |
| New `GitBranch` | Owns `issue-<id>` branch parsing (`issueFromCurrentBranch`), delegating the actual `git branch --show-current` call to an injected `GitClient` rather than re-implementing it |
| New `Git` facade | Thin wrapper directing `currentBranch`/`issueFromCurrentBranch` to `GitBranch`, injected into `PrOperations` |
| `AutoFixAllGithub` | `_prOperations(repoPath)` builds a fresh `gitClient`/`githubClient` per call (from the per-call `context`) instead of reusing constructor-level shared singletons |
| Extraction order | `GitBranch`+`Git` → `GitClient` → `GitHubClient` → `MergeBodyResolver` → `PrOperations` → `AutoFixAllGithub` |
| Tests | One spec file per class (new `GitBranch_spec.js`/`Git_spec.js`; updated `GitClient_spec.js`/`GitHubClient_spec.js`/`MergeBodyResolver_spec.js`), plus a parity update to `PrOperations_spec.js` — same per-class granularity as #291/#290 |

### Alternatives Considered

Once `GitHubClient` becomes a context-bound, per-repo instance, should its methods keep `repo`/`repoRef` as explicit params, or drop them too?

- **Chosen: full context-binding.** `GitHubClient` resolves `repo`/`repoRef` internally via `context.resolveWithRef()`. Method signatures lose `repo`/`repoRef` entirely (`getPr(branch)`, `mergePr(number, payload)`, `deleteBranch(branch)`, `getPrCommits(number)`). `PrOperations` never calls `context.resolveWithRef()` — no leftover infra resolution left in `PrOperations`.
- **Rejected: keep `repo`/`repoRef` as explicit params.** Would leave `PrOperations` still calling `context.resolveWithRef()` and threading `repo`/`repoRef` into every `GitHubClient` call. Its only upside — letting `AutoFixAllGithub` keep sharing one `githubClient` singleton across every repo it processes — isn't worth reintroducing that infra leakage.
- **Rejected: pass `context` per call instead of binding at construction.** Keeps `GitHubClient`/`GitClient` as repo-agnostic reusable singletons (`getPr(context, branch)`), avoiding any `AutoFixAllGithub` change. Rejected because it just swaps one param (`context`) for the several it removes, and doesn't match the constructor-injection shape the rest of this design commits to.
- **`GitBranch.currentBranch()` vs `GitClient.currentBranch()`** — chosen: `GitBranch` delegates to an injected `GitClient` (`{ context, gitClient = new GitClient({ context }) }`) rather than re-implementing the git CLI call, so `git branch --show-current` has a single implementation.

### Architecture

#### File structure

```
core/lib/
├── utils/git/
│   ├── GitClient.js                        ← UPDATED (context-bound)
│   ├── GitBranch.js                        ← NEW
│   └── Git.js                              ← NEW (facade)
├── utils/github/
│   ├── GitHubClient.js                     ← UPDATED (context-bound, drops repo/repoRef/token)
│   ├── MergeBodyResolver.js                ← UPDATED (absorbs repo/token via context)
│   └── PrOperations.js                     ← SIMPLIFIED (pure orchestration)
├── commands/
│   └── AutoFixAllGithub.js                 ← ADJUSTED (_prOperations builds fresh collaborators per call)

core/spec/
├── lib/utils/git/
│   ├── GitClient_spec.js                   ← UPDATED
│   ├── GitBranch_spec.js                   ← NEW
│   └── Git_spec.js                         ← NEW
└── lib/utils/github/
    ├── GitHubClient_spec.js                ← UPDATED
    ├── MergeBodyResolver_spec.js           ← UPDATED
    └── PrOperations_spec.js                ← UPDATED
```

#### `PrOperations` after refactor

Constructor receives all collaborators already context-bound:

```js
constructor({ context, gitClient = new GitClient({ context }),
              githubClient = new GitHubClient({ context }),
              gitBranch = new GitBranch({ context }),
              git = new Git({ context }),
              mergeBodyResolver = new MergeBodyResolver({ context, githubClient }) } = {}) {
```

Each public method no longer calls `context.getToken()` or `context.resolveWithRef()`, threads `token`/`repo`/`repoRef` to any collaborator, runs the issue-branch regex directly, or calls `_resolveMergeBody` — all of that moves into the injected collaborators.

Example (`prNumber`):

```js
async prNumber() {
  const issue = await this._git.issueFromCurrentBranch();

  if (issue) {
    const cached = await this._context.getIssueState(issue.id, 'pr_id');
    if (cached) return `${cached}
`;
  }

  const branch = issue ? issue.branch : await this._git.currentBranch();
  const pull = await this._github.getPr(branch);

  return `${pull.number}
`;
}
```

### Scope Boundaries

**In scope:** the file structure above, plus the corresponding spec files.

**Out of scope — explicitly unchanged:**
- `RepoContext` — already exposes `getToken()`/`resolveWithRef()`/`getIssueState()`/`readConfig()`; this refactor only consumes it.
- `Origin`/`GithubToken` — already wrapped by `RepoContext`, not touched directly.
- `BranchCleanup`/`IssueTagger` — `AutoFixAllGithub`'s `cleanup-branch`/`add-tag`/`remove-tag`/`hasShipitLabel` subcommands route through these, never through `PrOperations` or its collaborators.
- `AutoFixAllWaitCiAndMerge` — only calls `AutoFixAllGithub#prMerge` via default construction.

## Benefits

- `PrOperations` becomes a true thin orchestrator — no infra concerns (tokens, repo paths, repo refs) left in its methods.
- `git branch --show-current` and the `issue-<id>` regex each have exactly one implementation, reused by both `prNumber` and `prMerge` via `GitBranch`.
- `GitHubClient`/`MergeBodyResolver` calls read as pure domain operations (`getPr(branch)`, `buildBody(number, modelEmail)`) instead of infra-parameter lists.
- No externally visible or behavioral change — safe, low-risk internal cleanup that sets up a cleaner base for future PR-lifecycle work.

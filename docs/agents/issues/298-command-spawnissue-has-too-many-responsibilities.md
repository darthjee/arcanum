# Issue: Command SpawnIssue has too many responsibilities

## Problem

SpawnIssue (core/lib/commands/SpawnIssue.js) is too big and has too many responsibilities. Its constructor takes 5 domain collaborators (repoPath, origin, githubIssue, repoConfig, plus execFileAsync and sleepFn) when it should build a per-call RepoContext (mirroring AutoFixAllGithub#_prOperations) to bundle the repo-scoped collaborators instead of threading repoPath through them individually.

Additionally, SpawnIssue reads config via RepoConfig (single-tier, direct file read from .claude/state/arcanum-config.json) instead of using RepoContext.readConfig() which delegates to ConfigChain (3-tier with fallback). The corresponding shell script (arcanum/_lib/spawn_issue_shell.sh) has the same single-tier pattern via repo_config_read and should be updated to match.

## Solution

### 1. Add githubIssue to RepoContext

RepoContext (core/lib/context/RepoContext.js) currently wraps Origin, GithubToken, IssueStateService, and ConfigChain. Add GithubIssue as a fifth collaborator so SpawnIssue can access it through the context.

- Add githubIssue to RepoContext's constructor deps (with new GithubIssue() default)
- Expose a `createIssue(title, bodyFile)` delegate method that calls `this._githubIssue.create(this.repoPath, title, bodyFile)` internally. This matches every other RepoContext method (`resolve()`, `getToken()`, `getIssueState()`, `readConfig()`), all of which are narrow delegates that never hand back the raw collaborator — a raw `getGithubIssue()` getter would break that convention and leak GithubIssue's full surface (create/fetch/info) for no benefit, since SpawnIssue only ever calls `.create()`.

### 2. Initialize SpawnIssue with a per-call RepoContext

`core/bin/arcanum` always builds command instances with a zero-arg `new ModuleClass()`, then calls `.run(repoPath, ...args)` — `repoPath` only exists at call time, never at construction time. So SpawnIssue's constructor cannot take a `repoContext` parameter directly (there'd be no `repoPath` yet to build it with). Instead, follow the established pattern already used by `IssueState.js`, `ArcanumSplitIssueCreateSubIssue.js`, and especially `AutoFixAllGithub#_prOperations`: keep the *shared, stateless* collaborators on the constructor, and add a private `_repoContext(repoPath)` helper that builds a fresh `RepoContext` per call.

- Remove from constructor: repoPath, repoConfig
- Keep in constructor: origin, githubIssue, execFileAsync, sleepFn (all stateless/shareable across calls)
- Add: configChain (forwarded into each per-call RepoContext, mirroring AutoFixAllGithub's constructor deps)
- Add a private `_repoContext(repoPath)` helper: `new RepoContext({ repoPath, origin: this._origin, githubIssue: this._githubIssue, configChain: this._configChain })`

Update all internal references (each call site builds `const context = this._repoContext(repoPath);` once per `run()` invocation):

- this._repoPath.validate(repoPath) stays as-is (still needed before the context is built)
- this._origin.resolve(repoPath) to context.resolve()
- this._githubIssue.create(repoPath, title, bodyFile) to context.createIssue(title, bodyFile)
- this._repoConfig.getPlanIssuesRetryConfig(repoPath) to context.readConfig('plan-issues', 'max-retry-count') and context.readConfig('plan-issues', 'error-sleep-time') via ConfigChain

### 3. Migrate config reads from RepoConfig to ConfigChain

The getPlanIssuesRetryConfig method on RepoConfig reads plan-issues.max-retry-count and plan-issues.error-sleep-time single-tier. Migrate to ConfigChain.read(repoPath, 'plan-issues', 'max-retry-count') and ConfigChain.read(repoPath, 'plan-issues', 'error-sleep-time') which provides 3-tier fallback (repo to global to defaults).

Ensure ConfigChain has appropriate defaults for these keys (5 and 5 respectively, matching current DEFAULT_MAX_RETRY_COUNT and DEFAULT_ERROR_SLEEP_TIME).

Also update the shell script (arcanum/_lib/spawn_issue_shell.sh or the relevant _lib/repo_config.sh call) to use the config chain equivalent instead of direct single-tier repo_config_read for these keys, so both native and shell paths behave identically.

Scope confirmation: the shell-script update is confirmed in scope, not a follow-up — `arcanum/_lib/spawn_issue.sh` is an `engine_dispatch` shim that routes to either `spawn_issue_shell.sh` or the native `SpawnIssue.js` depending on each repo's `migration-status.json`; both paths are live simultaneously across different repos, so they must keep behaving identically.

### 4. Extract methods into separate classes

Extract the following from SpawnIssue into dedicated classes under core/lib/utils/issue/ — this matches the repo's actual convention: core/lib/commands/ is strictly 1:1 with subcommands registered in core/bin/arcanum's dispatch table, and neither of these becomes a standalone CLI subcommand (they're internal helpers only SpawnIssue calls, same shape as the existing Tags.js/IssueTagger.js in that folder):

**_applyLabels** becomes new class LabelApplicator in core/lib/utils/issue/

- Reads parent issue labels via gh issue view, filters canonical pipeline tags, applies Spawned label
- Receives execFileAsync and repoRef (or RepoContext) as dependencies
- Best-effort, never throws (preserve current behavior)

**_linkBack + _fetchNodeId** become new class IssueLinker in core/lib/utils/issue/

- Comments on parent and new issue (cross-linking)
- Optionally links as native GitHub sub-issue via addSubIssue GraphQL mutation
- _fetchNodeId becomes an internal helper of IssueLinker
- Best-effort, never throws (preserve current behavior)

**Stays in SpawnIssue**: _createWithRetry (core orchestration), _cleanup (simple scratch file deletion), _extractField (utility), run (entry point)

### Files affected

| File | Change |
| --- | --- |
| core/lib/commands/SpawnIssue.js | Main refactor target — new constructor (shared collaborators only), per-call _repoContext(repoPath) helper, delegate to extracted classes |
| core/lib/context/RepoContext.js | Add GithubIssue collaborator + createIssue(title, bodyFile) delegate |
| core/lib/utils/config/ConfigChain.js | Ensure plan-issues keys are supported with defaults |
| core/lib/utils/config/RepoConfig.js | Remove getPlanIssuesRetryConfig() — confirmed no consumers besides SpawnIssue |
| arcanum/_lib/spawn_issue_shell.sh | Update config reads to chain equivalent |
| New: core/lib/utils/issue/LabelApplicator.js | Extracted label application logic |
| New: core/lib/utils/issue/IssueLinker.js | Extracted cross-linking + sub-issue linking logic |
| core/spec/commands/SpawnIssueSpec.js | Update tests for new constructor signature |
| New: core/spec/utils/issue/LabelApplicatorSpec.js | Tests for extracted class |
| New: core/spec/utils/issue/IssueLinkerSpec.js | Tests for extracted class |

### Backward compatibility

Confirmed safe: the only external consumers of SpawnIssue are ArcanumSplitIssueCreateSubIssue.js (uses the zero-arg default `new SpawnIssue()`, unaffected by constructor changes) and core/bin/arcanum's CLI dispatch (also zero-arg construction). core/spec/bin/spawnIssueParity_spec.js requires `run()`'s `STATUS=ok/ID=/URL=`/`STATUS=failed` output stay byte-identical, which this refactor preserves — only `run()`'s internals change, not its signature or output contract. The only breakage is core/spec/lib/commands/SpawnIssueSpec.js itself, already listed in Files affected.

### Open questions

- Confirmed: RepoConfig.getPlanIssuesRetryConfig() has no consumers besides SpawnIssue, so it can be removed from RepoConfig.js once the migration to ConfigChain lands.

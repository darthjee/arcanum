# Issue: Centralize repoPath validation into Dispatcher/RepoContext

## Description
Follow-up carved out of #314 (itself #308's sub-issue 6). #308's sub-issue-6 text folded a `repoPath`-validation centralization pass into the same change that dropped the `takesRepoContext` flag. #321 removed the flag (via the `context: 'repo' | 'claude' | 'none'` enum, defined in `core/lib/core/commands.js`) and #314 finished the scaffold teardown, but the validation pass was deliberately deferred: it is a coordinated cross-command change that alters where the validation error is thrown and needs its own shell-parity re-verification. This issue tracks it on its own.

Today every `context: 'repo'` command's `run()` opens with a call equivalent to `await this._repoPathValidator.validate(this._repoContext.repoPath)`. `RepoPath#validate` (`core/lib/utils/file/RepoPath.js`) is the async shell-parity contract for `arcanum/_lib/repo_path.sh`'s `repo_path_enter` validation half — present, is-a-directory, is-a-git-repo — with the exact messages `Error: repo_path is required` / `Error: not a directory: <p>` / `Error: not a git repository: <p>`.

The guard is duplicated across 13 command modules, each carrying an injected dependency for it, with naming drift: `repoPathValidator` / `_repoPathValidator` in the `arcanum-split-issue-*`, `auto-fix-all-wait-ci*` and `spawn-issue` families; `repoPath` / `_repoPath` in `GithubIssue`, `IssueState`, `ListAgents`, `SafeBranch`, `AutoFixAllCheckoutFromMain`, `AutoFixAllCleanupArtifacts`.

## Problem
- The validation guard and its injected dependency are copy-pasted across 13 modules with inconsistent naming.
- `Dispatcher` (`core/lib/core/dispatcher.js`) already builds the `RepoContext` lazily from `args[0]` on the `context: 'repo'` path but never validates it; validation only happens once control is inside the command's `run()`.
- An audit of the current `context: 'repo'` registry shows the guard is **not** in fact uniform:
  - `github-issue-info` deliberately does not validate — it surfaces `Origin#resolve`'s `Error: '<p>' is not a git repository or has no 'origin' remote` instead, pinned by `githubIssueInfoParity_spec.js`.
  - `auto-fix-all-github-*` (7 subcommands), `auto-fix-all-reply-comment`, `resolve-and-fetch`, `resolve-id-and-file` and `resolve-plan-paths` do **not** validate today even though their `*_shell.sh` counterparts call `repo_path_enter` — a latent native/shell parity gap.
- Every shell entrypoint enforces its own arg-arity `Usage:` message **before** `repo_path_enter`, so `RepoPath#validate`'s `Error: repo_path is required` branch is effectively dead for the CLI; native mirrors this by throwing each command's `USAGE` string when `repoPath` is falsy before calling `validate()`.

## Expected Behavior
- Build and validate the `RepoContext` once in `Dispatcher`, and drop the per-command `repoPathValidator` / `repoPath` validation dependency and its `run()`-opening `validate(...)` call.
- Error strings unchanged — this is purely about *where* the throw happens. `RepoPath#validate`'s messages stay the shell-parity contract.
- Every migrated `context: 'repo'` entrypoint keeps byte-identical stdout / stderr / exit-code parity with its `*_shell.sh` counterpart.

## Solution
- **Where to hoist.** `RepoContext`'s constructor cannot do it — `RepoPath#validate` is async (`stat` + `git rev-parse`) and `RepoContext` is constructed with fake paths throughout the specs. Add a lazy `async validate()` on `RepoContext` that `Dispatcher` calls once on the `context: 'repo'` path, **after** `InvocationLog#record` (dispatcher.js:52) and **before** `await import()` of the command module (dispatcher.js:54) — i.e. a new guarded statement between those lines.
- **Absent leading arg is tracked separately in #333.** What happens when `args[0]` is empty (Dispatcher skips `validate()` and defers to the command's own `USAGE` throw, vs. always validating and accepting a one-time `Error: repo_path is required` divergence on the no-arg error path) is an independent behaviour decision carved out into #333. This issue assumes whichever outcome #333 lands; the hoist mechanics are the same either way.
- **`context: 'claude'`** (`permission-grant`, the only such entry) is out of scope — its leading anchor argument is not necessarily a git repository and `ClaudeContext` has its own contract.
- **Exemptions.** `github-issue-info` must stay on its `Origin#resolve` error contract — mark it (registry opt-out flag, or scope the hoist to entries that validate today).
- **Newly-strict surfaces.** Decide per-command whether `auto-fix-all-github-*`, `auto-fix-all-reply-comment`, `resolve-and-fetch`, `resolve-id-and-file`, `resolve-plan-paths` should gain the uniform guard (aligning native with their shell counterparts) or be exempted.
- **Collaborator path.** `GithubIssue#create` also runs as a `RepoContext#createIssue` collaborator (only in-process caller: `SpawnIssue.js`, itself `context: 'repo'` and Dispatcher-validated), not just via the CLI. When the guard is deleted from `GithubIssue`, add `await this.validate()` to `RepoContext#createIssue` so the collaborator method guards its own `repoPath` regardless of caller — with a `RepoContext` spec covering it.
- Remove the `RepoPath` import + ctor param from all 13 modules; for `GithubIssue` / `IssueState` this is a ctor-signature change that ripples into their specs.

## Tests
- Delete the per-command "validates `repoPath` first" / "short-circuits before … when repo-path validation fails" specs (e.g. `AutoFixAllCheckoutFromMain_spec.js`, `SafeBranch_spec.js`, `SpawnIssue_spec.js`, `AutoFixAllWaitCi_spec.js`, `AutoFixAllWaitCiAndMerge_spec.js`, `IssueState_spec.js`) and the fake `repoPathValidator` / `repoPath` injections from every migrated command spec (~10 files).
- Add `Dispatcher` specs: a `context: 'repo'` command with a present-but-non-dir / non-git leading arg throws the exact `RepoPath#validate` message from the dispatch layer, after `InvocationLog#record` has run. (The absent-leading-arg case is #333's.)
- Add a `RepoContext` spec: `createIssue` on a non-dir / non-git `repoPath` throws the `RepoPath#validate` message.
- Re-run the shell-parity check for **every** `context: 'repo'` migrated entrypoint (`core/spec/bin/*Parity_spec.js`) — the error is now raised before the command module loads. Add a non-dir / non-git `repo_path` case to the parity specs that only exercise valid git fixtures today, especially for the five newly-strict surfaces.

## Benefits
- One validation site instead of 13 copy-pasted guards; no more `repoPathValidator` vs `repoPath` naming drift.
- Closes the latent native/shell parity gap on the five `context: 'repo'` surfaces that under-validate today.
- `RepoContext` becomes the single owner of `repoPath` correctness, matching `repo_path_enter`'s role on the shell side.

## Out of scope
- The absent-leading-arg behaviour decision — carved out into #333.
- The `context` enum, the `dispatch-fixture-repo-context` scaffold, and the stale `takesRepoContext` references — handled by #321 and #314.
- Any change to `RepoPath#validate`'s own message strings or checks.
- `permission-grant` / `context: 'claude'` and `ClaudeContext`.

# Issue: Migrate auto-fix-issue-commit-change entrypoint to native Node.js

## Description

Part of the ongoing shell → Node.js entrypoint migration (see `docs/agents/architecture/script-engine.md`), tracked as batch overview #427. This issue migrates `auto-fix-issue/scripts/commit_change.sh` to a native `core/lib/` module.

`commit_change.sh` commits changes that a specialist agent has already staged, during `auto-fix-issue`'s implementation loop. Usage: `commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]`.

It builds a commit message of the form:

```
<type>(<scope>): <subject> (issue #<id>)

[<body>]

[Addresses-Comment: <comment_url>]

Co-Authored-By: <model_name> <model_email>   # unless model_coauthor_omitted
Co-Authored-By: <agent> agent <agent_email>
```

and commits it with `git commit -F -`. It does **not** run `git add` — the caller must have already staged the files it wants committed. It pushes the current branch afterward.

## Expected Behavior

- `arcanum` (native) `auto-fix-issue-commit-change <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]` produces byte-identical stdout and the same exit code as the shell script, for the same inputs and repo state (including the omitted-`body`, omitted-`comment_url`, and `model_coauthor_omitted` variants).
- With `engine.mode=native` in the target repo's config, the command dispatches to the native module; with `engine.mode=shell` or missing, it falls back to the existing shell script — verified via `arcanum/_lib/engine_dispatch.sh`.
- No regression to the "caller must pre-stage files" contract — the native module must not run `git add` on its own.

## Solution

Follow the standard migration process from `docs/agents/architecture/script-engine.md` — see the `auto-fix-all-cleanup-artifacts` migration (#254) for the closest existing precedent (also a git-commit-and-push entrypoint):

1. Read `auto-fix-issue/scripts/commit_change.sh` for its exact output/exit-code contract.
2. Rename it to `auto-fix-issue/scripts/commit_change_shell.sh` (the shell implementation, unchanged), and create a new `auto-fix-issue/scripts/commit_change.sh` as a thin `engine_dispatch` shim (mirror `auto-fix-all/scripts/cleanup_artifacts.sh`'s shim exactly), forwarding `HOME` in its env allowlist — every existing shim wrapping a script that runs `git commit`/`git push` forwards `HOME` (`cleanup_artifacts.sh`, `reply_comment.sh`, `wait_ci_and_merge.sh`, `wait_ci.sh`, `create_sub_issue.sh`, `push_sub_issues.sh`, `finish.sh`), so git can resolve committer identity once native's `env -i` strips the ambient environment; no other env var (no `GH_TOKEN`/`SSH_AUTH_SOCK`) appears anywhere in that same list, so none should be added here either.
3. Create `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — zero runtime npm deps, built-in Node APIs only.
4. Register `'auto-fix-issue-commit-change': { module: 'commands/auto-fix-issue/AutoFixIssueCommitChange.js', method: 'run' }` in the `COMMANDS` map at `core/lib/core/commands.js`.
5. Add `"auto-fix-issue-commit-change": true` to `arcanum/_lib/migration-status.json`.
6. Write native unit tests in `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js` (mirrors `core/lib/` 1:1 under `core/spec/lib/`).
7. Write a parity test in `core/spec/bin/autoFixIssueCommitChangeParity_spec.js` — shell vs. native, identical inputs, asserting identical stdout and exit code. Run the parity test directly against `commit_change_shell.sh` (never through the new `commit_change.sh` shim, which would make the test circular) versus `core/bin/arcanum auto-fix-issue-commit-change`, following `autoFixAllCleanupArtifactsParity_spec.js`'s structure (isolated fixture repos per side, `git config user.*` for a deterministic committer identity, normalizing the non-deterministic abbreviated commit hash out of `git commit`'s own stdout summary before comparing).
8. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly: `engine.mode=native` → native; `engine.mode=shell` (or missing) → shell fallback.

The `AutoFixAllCleanupArtifacts.js` precedent (#254, also `git commit -F -` + push) re-derives its own local `execFileAsync`-with-stdin helper and private `_commit`/`_pushCurrentBranch` methods directly on the command class, rather than reaching for a shared git wrapper — `core/lib/utils/git/GitClient.js` (currently just `currentBranch()`, extracted from PR-lifecycle flows) predates that choice and isn't used there. Follow `AutoFixAllCleanupArtifacts.js`'s inline pattern for consistency, unless extending `GitClient.js` turns out to fit better in practice — implementer's call, not a hard requirement either way.

The native module needs to re-derive, rather than shell out to, the logic currently living in three shared bash helpers this script sources:
- `arcanum/_lib/push.sh`'s `push_current_branch` (`git push -u origin <branch>:<branch>`), not yet migrated.
- `arcanum/_lib/commit_template.sh`'s `commit_template_engine_get` (decides "new" vs. legacy trailer format).
- `arcanum/_lib/agent_email.sh`'s `agent_email_get` and `model_coauthor_omitted` — the latter reads the `git.omit_model_coauthor` config key (resolved local state → repo config → global, via `config_chain_read`); default `false`, purely opt-in. The chain-resolution logic itself is already migrated as `core/lib/utils/config/ConfigChain.js` — reuse it rather than re-deriving `config_chain_read`.

## Benefits

- Moves `auto-fix-issue` one entrypoint closer to running fully on the native engine, per the project's ongoing shell → Node.js migration.
- Removes a bash dependency (and its three sourced helper scripts' worth of indirection) from the hot commit path used by every specialist agent during `auto-fix-issue`.
- Establishes parity test coverage that protects the exact commit-message/trailer format (including the `model_coauthor_omitted` and `Addresses-Comment:` edge cases) against regressions.

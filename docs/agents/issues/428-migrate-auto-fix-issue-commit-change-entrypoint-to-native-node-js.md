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

Follow the standard migration process from `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-issue/scripts/commit_change.sh` for its exact output/exit-code contract.
2. Create `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — zero runtime npm deps, built-in Node APIs only.
3. Register `'auto-fix-issue-commit-change': { module: 'commands/auto-fix-issue/AutoFixIssueCommitChange.js', method: 'run' }` in the `COMMANDS` map at `core/lib/core/commands.js`.
4. Add `"auto-fix-issue-commit-change": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js`.
6. Write a parity test — shell vs. native, identical inputs, asserting identical stdout and exit code.
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly: `engine.mode=native` → native; `engine.mode=shell` (or missing) → shell fallback.

`core/lib/utils/git/GitClient.js` already wraps `git` CLI calls via `execFile` (currently just `currentBranch()`) — extend it (or follow its pattern) for the new `git commit -F -` and `git push` calls needed here, rather than inventing a separate git-shelling approach.

The native module needs to re-derive, rather than shell out to, the logic currently living in three shared bash helpers this script sources:
- `arcanum/_lib/push.sh`'s `push_current_branch` (`git push -u origin <branch>:<branch>`), not yet migrated.
- `arcanum/_lib/commit_template.sh`'s `commit_template_engine_get` (decides "new" vs. legacy trailer format).
- `arcanum/_lib/agent_email.sh`'s `agent_email_get` and `model_coauthor_omitted` — the latter reads the `git.omit_model_coauthor` config key (resolved local state → repo config → global, via `config_chain_read`); default `false`, purely opt-in. The chain-resolution logic itself is already migrated as `core/lib/utils/config/ConfigChain.js` — reuse it rather than re-deriving `config_chain_read`.

## Benefits

- Moves `auto-fix-issue` one entrypoint closer to running fully on the native engine, per the project's ongoing shell → Node.js migration.
- Removes a bash dependency (and its three sourced helper scripts' worth of indirection) from the hot commit path used by every specialist agent during `auto-fix-issue`.
- Establishes parity test coverage that protects the exact commit-message/trailer format (including the `model_coauthor_omitted` and `Addresses-Comment:` edge cases) against regressions.

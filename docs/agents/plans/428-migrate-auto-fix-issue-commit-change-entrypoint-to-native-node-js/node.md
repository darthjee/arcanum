# node Plan: Migrate auto-fix-issue-commit-change entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registers `'auto-fix-issue-commit-change'` in `core/lib/core/commands.js`'s `COMMANDS` map — this exact string must match the `migration-status.json` key and the `<command>` argument scripter's shim passes to `engine_dispatch`.
- Writes the parity test against `auto-fix-issue/scripts/commit_change_shell.sh` — the exact path scripter's rename produces — invoked directly, never through the shim.
- Can rely on `HOME` being present in `process.env` when invoked natively through scripter's shim (needed for `git commit`/`git push` to resolve identity/config).

## Implementation Steps

### Step 1 — Implement the native module and register it

Create `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js`, following `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js`'s pattern closely (same family of entrypoint: stage-then-`git commit -F -`-then-push, constructed with a `RepoContext`):

- Constructor: `constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {})`, same shape as `AutoFixAllCleanupArtifacts`.
- `run(type, scope, id, subject, agent, modelName, modelEmail, body, commentUrl)`: validates all required args are present (`type`, `scope`, `id`, `subject`, `agent`, `modelName`, `modelEmail` — `body`/`commentUrl` optional), throwing `Error(USAGE)` on the first missing one, matching `commit_change_shell.sh`'s combined usage-check contract.
- Re-derive, inline on this class (per `docs/agents/architecture/script-engine.md`'s "no standalone, wholesale `_lib` migration" rule — do not create new shared `_lib`-equivalent modules for these three helpers):
  - `commit_template.sh`'s `commit_template_engine_get`: checks for `.github/commit_message_template-2.0.md` (→ `"new"`) then `.github/commit_message_template.md` (→ `"old"`), defaulting to `"new"` when neither exists.
  - `agent_email.sh`'s `agent_email_get(agent, modelEmail)`: reads config key `git.agents.<agent>.email` via `ConfigChain` (`core/lib/utils/config/ConfigChain.js` — reuse this directly, it's already the native counterpart of `config_chain_read`); substitutes `{agent}` in the resolved template if present, falling back to `modelEmail` when the config value is absent/`null`.
  - `agent_email.sh`'s `model_coauthor_omitted()`: reads config key `git.omit_model_coauthor` via the same `ConfigChain`; `true` only when that value is the literal string/boolean `true`, `false` otherwise (including absent).
- Build the commit message exactly as `commit_change_shell.sh` does: `"${type}(${scope}): ${subject} (issue #${id})"`, then optionally the body (blank line + body), then optionally `Addresses-Comment: <commentUrl>` (blank line + line), then a blank line, then `Co-Authored-By: <modelName> <modelEmail>` (unless `model_coauthor_omitted`), then `Co-Authored-By: <agent> agent <agentEmail>` — join with `\n`, matching the shell script's exact blank-line placement.
- Commit with `git commit -F -`, piping the message via `options.input` (mirror `AutoFixAllCleanupArtifacts.js`'s `defaultExecFileAsync` stdin-supporting wrapper — copy that helper, since it isn't shared/exported elsewhere yet).
- Push via a locally re-derived `push_current_branch` equivalent: resolve `git branch --show-current`, then `git push -u origin <branch>:<branch>` — same as `AutoFixAllCleanupArtifacts.js#_pushCurrentBranch`.
- Return `commitStdout + pushStdout`, relaying both verbatim (neither call's stdout is redirected in the shell script), matching the existing precedent's return contract.

Register in `core/lib/core/commands.js`'s `COMMANDS` map, alphabetically between `'auto-fix-all-wait-ci-and-merge'` and `'checkout-safe-branch'`:

```js
'auto-fix-issue-commit-change': {
  module: 'commands/auto-fix-issue/AutoFixIssueCommitChange.js',
  method: 'run',
  context: 'repo'
},
```

### Step 2 — Unit and parity tests

Write `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js` (Jasmine, mirroring `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js`'s structure): mock `execFileAsync`, cover the usage-error path (each required arg missing in turn), the commit-message construction (with/without `body`, with/without `commentUrl`, `model_coauthor_omitted` true/false, "new" vs. "old" template engine affecting the agent email), and the commit+push stdout concatenation.

Write `core/spec/bin/autoFixIssueCommitChangeParity_spec.js` (mirroring `autoFixAllCleanupArtifactsParity_spec.js`'s structure exactly): isolated fixture repos per side (shell vs. native) via `createGitFixtureRepo`/`createTempDir`, `git config user.*` for a deterministic committer identity, comparing `commit_change_shell.sh` directly against `core/bin/arcanum auto-fix-issue-commit-change` for byte-identical stdout/exit code — cover at minimum: the happy path with `body` and `comment_url` both present, both absent, `model_coauthor_omitted=true` (via repo-local config), and a missing-required-argument hard failure. Normalize the non-deterministic abbreviated commit hash out of `git commit`'s own stdout summary before comparing (same `normalizeCommitHash` approach). This test set is also what exercises `arcanum/_lib/engine_dispatch.sh`'s `engine.mode=native`/`engine.mode=shell` routing end-to-end, satisfying that verification step.

## Files to Change

- `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — new native module.
- `core/lib/core/commands.js` — add the `auto-fix-issue-commit-change` entry.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js` — new unit tests.
- `core/spec/bin/autoFixIssueCommitChangeParity_spec.js` — new parity tests.

## CI Checks

- `core/`: `yarn test` (CI job: `test`, `.circleci/config.yml`) — local equivalent: `make core-test`.
- `core/`: `yarn lint` (CI job: `checks`, `.circleci/config.yml`) — local equivalent: `make core-lint`.

## Notes

- Do not touch `core/lib/utils/git/GitClient.js` unless extending it turns out cleaner in practice than the inline `AutoFixAllCleanupArtifacts.js`-style approach above — implementer's call, not required either way (see main plan's precedent discussion).
- `arcanum/_lib/push.sh`, `arcanum/_lib/commit_template.sh`, and `arcanum/_lib/agent_email.sh` stay untouched — only their logic is re-derived here, per the migration's "no wholesale `_lib` migration" rule.

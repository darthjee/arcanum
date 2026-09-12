# Create the native module

Create `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`, a
zero-runtime-dependency native equivalent of `auto-new-issue/scripts/commit_issue.sh`
(soon to be `commit_issue_shell.sh`, see [scripter.md](../scripter.md)). Model it
directly on `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`:

- Constructor `(repoContext, { execFileAsync = defaultExecFileAsync, configChain = new ConfigChain() } = {})`,
  storing `repoContext`/`execFileAsync`/`configChain` on `this`.
- Copy `AutoPlanIssueCommitPlan.js`'s `defaultExecFileAsync` helper verbatim
  (stdin-capable `execFile` wrapper needed for `git commit -F -`) — do not
  import it from there; it isn't a shared/exported utility yet.
- `async run(filePath, id, modelName, modelEmail)`:
  - `repoPath = this._repoContext.repoPath`.
  - Validate all five values (`repoPath`, `filePath`, `id`, `modelName`,
    `modelEmail`) are present; throw `new Error(USAGE)` on the first
    missing/empty one, where
    `USAGE = 'Usage: commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>'`.
  - Validate `filePath` exists and is a file (reuse the `stat`-based
    `_fileExists`/`_isDirectory` pattern from `AutoPlanIssueCommitPlan.js`, but
    checking `stats.isFile()` here instead of `isDirectory()`); throw
    `new Error(\`Error: file not found: ${filePath}\`)` if not.
  - `git add <filePath>` (`cwd: repoPath`), mirroring the shell script's own
    `git add "$FILE_PATH"`.
  - Build the commit message via `_buildMessage` (see below).
  - Commit (`_commit`, identical to `AutoPlanIssueCommitPlan.js`'s) and push
    (`_pushCurrentBranch`, identical too), returning
    `commitStdout + pushStdout`.
- `_buildMessage(repoPath, id, modelName, modelEmail)`:
  - Resolve `templateEngine` via `_commitTemplateEngineGet` (copy verbatim from
    `AutoPlanIssueCommitPlan.js`).
  - `agentEmail = templateEngine === 'new' ? await this._agentEmailGet(repoPath, modelEmail) : modelEmail`
    — reuse `_agentEmailGet` with the agent fixed to the literal `'architect'`
    (a module-level `const AGENT = 'architect'`, same as
    `AutoPlanIssueCommitPlan.js`).
  - `omitModelCoauthor` via `_modelCoauthorOmitted` (copy verbatim).
  - Assemble: `docs(issue): add issue file (issue #${id})`, blank line, then
    (unless `omitModelCoauthor`) `Co-Authored-By: ${modelName} <${modelEmail}>`,
    then `Co-Authored-By: architect agent <${agentEmail}>`. Note the commit
    `type(scope)` and subject differ from `AutoPlanIssueCommitPlan.js`
    (`docs(issue): add issue file` vs. `docs(plan): add implementation plan`)
    but the trailer assembly is otherwise identical.
- Copy `_commitTemplateEngineGet`, `_agentEmailGet` (with `AGENT` fixed to
  `'architect'`), `_modelCoauthorOmitted`, `_commit`, and `_pushCurrentBranch`
  from `AutoPlanIssueCommitPlan.js` verbatim — same repo-config/`push -u`
  behavior applies here unchanged.
- Full JSDoc on the class and every method, matching the density and style of
  `AutoPlanIssueCommitPlan.js` and `AutoFixIssueCommitChange.js`.

## Files to Change

- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` — new native
  module implementing the migrated `commit_issue.sh` entrypoint.
